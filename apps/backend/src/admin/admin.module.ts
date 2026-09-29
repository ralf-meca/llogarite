import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// UsersModule is here for AdminGuard, which reads the flag off the user row.
@Module({
    imports: [TypeOrmModule.forFeature([Invoice]), UsersModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
