import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { Invoice } from './invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
    imports: [TypeOrmModule.forFeature([Invoice]), UsersModule, NotificationsModule],
    controllers: [InvoicesController],
    providers: [InvoicesService],
})
export class InvoicesModule {}
