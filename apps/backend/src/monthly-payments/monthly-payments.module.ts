import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyPayment } from './monthly-payment.entity';
import { MonthlyPaymentsController } from './monthly-payments.controller';
import { MonthlyPaymentsService } from './monthly-payments.service';

@Module({
    imports: [TypeOrmModule.forFeature([MonthlyPayment])],
    controllers: [MonthlyPaymentsController],
    providers: [MonthlyPaymentsService],
})
export class MonthlyPaymentsModule {}
