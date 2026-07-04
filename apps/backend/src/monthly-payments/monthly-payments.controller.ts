import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonthlyPayment } from './monthly-payment.entity';
import { MonthlyPaymentPatch, MonthlyPaymentsService } from './monthly-payments.service';

@Controller('monthly-payments')
@UseGuards(JwtAuthGuard)
export class MonthlyPaymentsController {
    constructor(private readonly monthlyPaymentsService: MonthlyPaymentsService) {}

    @Post()
    create(@CurrentUser() userId: string, @Body() data: MonthlyPaymentPatch): Promise<MonthlyPayment> {
        return this.monthlyPaymentsService.create(userId, data);
    }

    @Get()
    findAll(@CurrentUser() userId: string): Promise<MonthlyPayment[]> {
        return this.monthlyPaymentsService.findAll(userId);
    }

    @Patch(':id')
    update(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() data: MonthlyPaymentPatch,
    ): Promise<MonthlyPayment> {
        return this.monthlyPaymentsService.update(userId, id, data);
    }

    @Delete(':id')
    remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.monthlyPaymentsService.remove(userId, id);
    }
}
