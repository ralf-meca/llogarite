import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { PROJECT_KINDS, Project, type ProjectKind } from './project.entity';

export type ProjectPatch = Partial<{
    name: string;
    details: string | null;
    budget: number;
    kind: ProjectKind;
    startDate: string | null;
    endDate: string | null;
    buddyIds: string[];
}>;

// The fields a client may set. Anything else in the body is dropped, so a
// patch cannot reach columns like the owner.
const PATCHABLE_FIELDS = ['name', 'details', 'budget', 'kind', 'startDate', 'endDate', 'buddyIds'] as const;

// Dates travel as YYYY-MM-DD, which compare correctly as plain strings.
function assertValidSpan(kind: ProjectKind, startDate: string | null, endDate: string | null): void {
    if (!PROJECT_KINDS.includes(kind)) {
        throw new BadRequestException('kind must be project or trip');
    }
    if (kind === 'trip' && (!startDate || !endDate)) {
        throw new BadRequestException('a trip needs a start date and an end date');
    }
    if (startDate && endDate && endDate < startDate) {
        throw new BadRequestException('endDate cannot be before startDate');
    }
}

// One expense on a shared project, carrying who paid for it. A trip is only
// readable if you can see whose receipt each line was.
export type ProjectExpense = {
    id: string;
    createdAt: Date;
    data: Record<string, unknown>;
    ownerId: string;
    ownerName: string | null;
    ownerEmail: string;
};

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private readonly projectsRepository: Repository<Project>,
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
    ) {}

    // Attached buddies can read a project; only its creator can change it.
    private canView(project: Project, userId: string): boolean {
        return project.userId === userId || project.buddyIds.includes(userId);
    }

    private async findViewable(id: string, userId: string): Promise<Project> {
        const project = await this.projectsRepository.findOne({ where: { id } });
        if (!project || !this.canView(project, userId)) {
            throw new NotFoundException();
        }
        return project;
    }

    // Every expense on the project, whoever entered it - the point of sharing
    // one is that a trip's costs sit together rather than in each person's
    // own list.
    async findExpenses(userId: string, id: string): Promise<ProjectExpense[]> {
        await this.findViewable(id, userId);

        const invoices = await this.invoicesRepository.find({
            where: { projectId: id },
            relations: { user: true },
            order: { createdAt: 'DESC' },
        });

        return invoices.map((invoice) => ({
            id: invoice.id,
            createdAt: invoice.createdAt,
            data: invoice.data,
            ownerId: invoice.userId,
            ownerName: invoice.user?.name ?? null,
            ownerEmail: invoice.user?.email ?? '',
        }));
    }

    // Settles shares on the caller's own invoices in this project - one person's
    // when someone is named, everyone's otherwise. Only their own invoices: the
    // owner keeps the record of what was repaid on a receipt they entered.
    //
    // When buddies paid some or all of the bill (data.payments, or data.paidBy
    // on older invoices), the owner may owe them instead; naming the caller
    // settles that (data.ownerPaid). Whether anything was actually owed is the
    // client's sum to do - a flag on someone with no debt changes nothing.
    async markOwnExpensesPaid(userId: string, id: string, buddyId?: string): Promise<void> {
        await this.findViewable(id, userId);

        const invoices = await this.invoicesRepository.find({ where: { projectId: id, userId } });
        for (const invoice of invoices) {
            const buddies = Array.isArray(invoice.data.buddies)
                ? (invoice.data.buddies as Array<Record<string, unknown>>)
                : [];
            const payerId = typeof invoice.data.paidBy === 'string' && invoice.data.paidBy ? invoice.data.paidBy : null;
            const settles = (buddy: Record<string, unknown>) =>
                buddy.paid !== true &&
                buddy.userId !== payerId &&
                (buddyId === undefined || buddy.userId === buddyId);
            const payments =
                invoice.data.payments && typeof invoice.data.payments === 'object'
                    ? Object.values(invoice.data.payments as Record<string, unknown>)
                    : [];
            const othersPaid = payerId !== null || payments.some((amount) => typeof amount === 'number' && amount > 0);
            const settlesOwner =
                othersPaid &&
                invoice.data.ownerPaid !== true &&
                (buddyId === undefined || buddyId === userId);
            if (!settlesOwner && !buddies.some(settles)) {
                continue;
            }
            const data = {
                ...invoice.data,
                buddies: buddies.map((buddy) => (settles(buddy) ? { ...buddy, paid: true } : buddy)),
                ...(settlesOwner ? { ownerPaid: true } : {}),
            };
            await this.invoicesRepository.update(invoice.id, { data });
        }
    }

    async create(userId: string, data: ProjectPatch): Promise<Project> {
        if (!data.name || typeof data.name !== 'string') {
            throw new BadRequestException('name is required');
        }
        if (typeof data.budget !== 'number' || !Number.isFinite(data.budget) || data.budget < 0) {
            throw new BadRequestException('budget must be a non-negative number');
        }
        const kind = data.kind ?? 'project';
        // A plain project has no start, whatever the client sent along.
        const startDate = kind === 'trip' ? (data.startDate ?? null) : null;
        const endDate = data.endDate ?? null;
        assertValidSpan(kind, startDate, endDate);

        const project = this.projectsRepository.create({
            userId,
            name: data.name,
            details: data.details ?? null,
            budget: data.budget,
            kind,
            startDate,
            endDate,
            buddyIds: data.buddyIds ?? [],
        });
        return this.projectsRepository.save(project);
    }

    // Projects you created, plus the ones you have been attached to - a buddy
    // on a trip needs to see it to file expenses against it.
    //
    // The buddy check takes its own parameter, cast to text: `userId` is a
    // uuid column and `buddyIds` a text array, and one shared parameter cannot
    // be both - Postgres rejects it with "operator does not exist: uuid = text".
    findAll(userId: string): Promise<Project[]> {
        return this.projectsRepository
            .createQueryBuilder('project')
            .where('project.userId = :userId', { userId })
            .orWhere('CAST(:buddyId AS text) = ANY(project.buddyIds)', { buddyId: userId })
            .orderBy('project.createdAt', 'DESC')
            .getMany();
    }

    async update(userId: string, id: string, patch: ProjectPatch): Promise<Project> {
        const project = await this.projectsRepository.findOne({ where: { id } });
        if (!project || project.userId !== userId) {
            throw new NotFoundException();
        }
        const changes: ProjectPatch = {};
        for (const field of PATCHABLE_FIELDS) {
            if (patch[field] !== undefined) {
                Object.assign(changes, { [field]: patch[field] });
            }
        }
        const kind = changes.kind ?? project.kind;
        if (kind !== 'trip') {
            changes.startDate = null;
        }
        const startDate = changes.startDate !== undefined ? changes.startDate : project.startDate;
        const endDate = changes.endDate !== undefined ? changes.endDate : project.endDate;
        assertValidSpan(kind, startDate, endDate);

        if (Object.keys(changes).length > 0) {
            await this.projectsRepository.update(id, changes);
        }
        return { ...project, ...changes };
    }

    async remove(userId: string, id: string): Promise<void> {
        const project = await this.projectsRepository.findOne({ where: { id } });
        if (!project || project.userId !== userId) {
            throw new NotFoundException();
        }
        await this.projectsRepository.delete(id);
    }
}
