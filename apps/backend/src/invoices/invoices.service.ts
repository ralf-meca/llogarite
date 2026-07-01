import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';

@Injectable()
export class InvoicesService {
    constructor(
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
    ) {}

    async create(data: Record<string, unknown>): Promise<Invoice> {
        const iic = data.iic;
        if (typeof iic !== 'string' || !iic) {
            throw new BadRequestException('iic is required');
        }

        const existing = await this.invoicesRepository.findOne({ where: { iic } });
        if (existing) {
            return existing;
        }

        const invoice = this.invoicesRepository.create({ iic, data });
        return this.invoicesRepository.save(invoice);
    }

    findAll(): Promise<Invoice[]> {
        return this.invoicesRepository.find({ order: { createdAt: 'DESC' } });
    }
}
