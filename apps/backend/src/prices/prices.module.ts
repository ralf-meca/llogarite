import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { UsersModule } from '../users/users.module';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

// UsersModule is here for PremiumGuard.
@Module({
    imports: [TypeOrmModule.forFeature([Invoice]), UsersModule],
    controllers: [PricesController],
    providers: [PricesService],
})
export class PricesModule {}
