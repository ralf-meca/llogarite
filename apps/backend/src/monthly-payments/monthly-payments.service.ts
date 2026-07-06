import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyPayment } from './monthly-payment.entity';

export type MonthlyPaymentPatch = Partial<{
    name: string;
    amount: number;
    dueDay: number;
    lastPaidMonth: string | null;
    buddyIds: string[];
}>;

@Injectable()
export class MonthlyPaymentsService {
    constructor(
        @InjectRepository(MonthlyPayment)
        private readonly monthlyPaymentsRepository: Repository<MonthlyPayment>,
    ) {}

    async create(userId: string, data: MonthlyPaymentPatch): Promise<MonthlyPayment> {
        if (!data.name || typeof data.name !== 'string') {
            throw new BadRequestException('name is required');
        }
        if (typeof data.amount !== 'number' || !Number.isFinite(data.amount)) {
            throw new BadRequestException('amount is required');
        }
        if (typeof data.dueDay !== 'number' || data.dueDay < 1 || data.dueDay > 31) {
            throw new BadRequestException('dueDay must be between 1 and 31');
        }

        const payment = this.monthlyPaymentsRepository.create({
            userId,
            name: data.name,
            amount: data.amount,
            dueDay: data.dueDay,
            lastPaidMonth: null,
            buddyIds: data.buddyIds ?? [],
        });
        return this.monthlyPaymentsRepository.save(payment);
    }

    findAll(userId: string): Promise<MonthlyPayment[]> {
        return this.monthlyPaymentsRepository.find({ where: { userId }, order: { dueDay: 'ASC' } });
    }

    async update(userId: string, id: string, patch: MonthlyPaymentPatch): Promise<MonthlyPayment> {
        const payment = await this.monthlyPaymentsRepository.findOne({ where: { id } });
        if (!payment || payment.userId !== userId) {
            throw new NotFoundException();
        }
        await this.monthlyPaymentsRepository.update(id, patch);
        return { ...payment, ...patch };
    }

    async remove(userId: string, id: string): Promise<void> {
        const payment = await this.monthlyPaymentsRepository.findOne({ where: { id } });
        if (!payment || payment.userId !== userId) {
            throw new NotFoundException();
        }
        await this.monthlyPaymentsRepository.delete(id);
    }
}
