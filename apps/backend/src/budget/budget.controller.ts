import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Budget } from './budget.entity';
import { BudgetService } from './budget.service';

type CategoryAllocation = { mode: 'percent' | 'amount'; value: number };

function parseCategoryAllocations(
    input: Record<string, CategoryAllocation> | null | undefined,
): Record<string, CategoryAllocation> | null {
    if (!input) {
        return null;
    }
    const result: Record<string, CategoryAllocation> = {};
    for (const [category, allocation] of Object.entries(input)) {
        if (allocation.mode !== 'percent' && allocation.mode !== 'amount') {
            throw new BadRequestException(`invalid allocation mode for ${category}`);
        }
        const value = Number(allocation.value);
        if (!Number.isFinite(value) || value < 0) {
            throw new BadRequestException(`invalid allocation value for ${category}`);
        }
        if (allocation.mode === 'percent' && value > 100) {
            throw new BadRequestException(`percent allocation for ${category} cannot exceed 100`);
        }
        result[category] = { mode: allocation.mode, value };
    }
    return result;
}

@Controller('budget')
@UseGuards(JwtAuthGuard)
export class BudgetController {
    constructor(private readonly budgetService: BudgetService) {}

    @Get()
    get(@CurrentUser() userId: string): Promise<Budget | null> {
        return this.budgetService.get(userId);
    }

    @Put()
    upsert(
        @CurrentUser() userId: string,
        @Body() body: { amount: number; categoryAllocations?: Record<string, CategoryAllocation> | null },
    ): Promise<Budget> {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) {
            throw new BadRequestException('amount must be a non-negative number');
        }
        const categoryAllocations = parseCategoryAllocations(body.categoryAllocations);
        return this.budgetService.upsert(userId, amount, categoryAllocations);
    }
}
