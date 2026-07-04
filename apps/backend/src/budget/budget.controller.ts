import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Budget } from './budget.entity';
import { BudgetService } from './budget.service';

@Controller('budget')
@UseGuards(JwtAuthGuard)
export class BudgetController {
    constructor(private readonly budgetService: BudgetService) {}

    @Get()
    get(@CurrentUser() userId: string): Promise<Budget | null> {
        return this.budgetService.get(userId);
    }

    @Put()
    upsert(@CurrentUser() userId: string, @Body() body: { amount: number }): Promise<Budget> {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) {
            throw new BadRequestException('amount must be a non-negative number');
        }
        return this.budgetService.upsert(userId, amount);
    }
}
