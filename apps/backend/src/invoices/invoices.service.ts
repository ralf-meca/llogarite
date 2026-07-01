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

        const existing = await this.invoicesRepository.findOne({ where: { userId, iic } });
        if (existing) {
            return existing;
        }

        const invoice = this.invoicesRepository.create({ iic, data, userId });
        return this.invoicesRepository.save(invoice);
    }

    findAll(userId: string): Promise<Invoice[]> {
        return this.invoicesRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }

    async remove(userId: string, id: string): Promise<void> {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice || invoice.userId !== userId) {
            throw new NotFoundException();
        }
        await this.invoicesRepository.delete(id);
    }
}
