import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './budget.entity';

@Injectable()
export class BudgetService {
    constructor(
        @InjectRepository(Budget)
        private readonly budgetRepository: Repository<Budget>,
    ) {}

    get(userId: string): Promise<Budget | null> {
        return this.budgetRepository.findOne({ where: { userId } });
    }

    async upsert(userId: string, amount: number): Promise<Budget> {
        const existing = await this.budgetRepository.findOne({ where: { userId } });
        if (existing) {
            await this.budgetRepository.update(existing.id, { amount });
            return { ...existing, amount };
        }
        const budget = this.budgetRepository.create({ userId, amount });
        return this.budgetRepository.save(budget);
    }
}
