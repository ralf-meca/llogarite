import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';

export type ProjectPatch = Partial<{
    name: string;
    details: string | null;
    budget: number;
    endDate: string | null;
    buddyIds: string[];
}>;

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private readonly projectsRepository: Repository<Project>,
    ) {}

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

    findAll(userId: string): Promise<Project[]> {
        return this.projectsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
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
