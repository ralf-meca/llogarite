import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { Project } from './project.entity';

export type ProjectPatch = Partial<{
    name: string;
    details: string | null;
    budget: number;
    endDate: string | null;
    buddyIds: string[];
}>;

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

    // Settles every share on the caller's own invoices in this project. Only
    // their own: marking an invoice paid is the payer saying they were paid,
    // and nobody else is in a position to say it for them.
    async markOwnExpensesPaid(userId: string, id: string): Promise<void> {
        await this.findViewable(id, userId);

        const invoices = await this.invoicesRepository.find({ where: { projectId: id, userId } });
        for (const invoice of invoices) {
            const buddies = Array.isArray(invoice.data.buddies)
                ? (invoice.data.buddies as Array<Record<string, unknown>>)
                : [];
            if (buddies.length === 0) {
                continue;
            }
            const data = { ...invoice.data, buddies: buddies.map((buddy) => ({ ...buddy, paid: true })) };
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

        const project = this.projectsRepository.create({
            userId,
            name: data.name,
            details: data.details ?? null,
            budget: data.budget,
            endDate: data.endDate ?? null,
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
        await this.projectsRepository.update(id, patch);
        return { ...project, ...patch };
    }

    async remove(userId: string, id: string): Promise<void> {
        const project = await this.projectsRepository.findOne({ where: { id } });
        if (!project || project.userId !== userId) {
            throw new NotFoundException();
        }
        await this.projectsRepository.delete(id);
    }
}
