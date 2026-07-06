import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';

@Injectable()
export class InvoicesService {
    constructor(
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
    ) {}

    async create(userId: string, data: Record<string, unknown>): Promise<Invoice> {
        const iic = data.iic;
        if (typeof iic !== 'string' || !iic) {
            throw new BadRequestException('iic is required');
        }
        const projectId = typeof data.projectId === 'string' ? data.projectId : null;
        const verified = data.verified === true;

        const existing = await this.invoicesRepository.findOne({ where: { userId, iic } });
        if (existing) {
            return existing;
        }

        const invoice = this.invoicesRepository.create({ iic, data, userId, projectId, verified });
        return this.invoicesRepository.save(invoice);
    }

    findAll(userId: string): Promise<Invoice[]> {
        return this.invoicesRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }

    async update(userId: string, id: string, data: Record<string, unknown>): Promise<Invoice> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice || invoice.userId !== userId) {
            throw new NotFoundException();
        }
        const projectId = typeof data.projectId === 'string' ? data.projectId : null;
        // Editing an invoice invalidates its official-verification status, regardless of
        // what the client sends.
        await this.invoicesRepository.update(id, { data, projectId, verified: false });
        return { ...invoice, data, projectId, verified: false };
    }

    async remove(userId: string, id: string): Promise<void> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice || invoice.userId !== userId) {
            throw new NotFoundException();
        }
        await this.invoicesRepository.delete(id);
    }
}
