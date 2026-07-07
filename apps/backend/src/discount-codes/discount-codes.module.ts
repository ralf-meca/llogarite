import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { DiscountCode } from './discount-code.entity';
import { DiscountCodesController } from './discount-codes.controller';
import { DiscountCodesService } from './discount-codes.service';

@Module({
    imports: [TypeOrmModule.forFeature([DiscountCode]), UsersModule],
    controllers: [DiscountCodesController],
    providers: [DiscountCodesService],
})
export class DiscountCodesModule {}
