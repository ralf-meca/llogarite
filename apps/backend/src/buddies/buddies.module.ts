import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { BuddyConnection } from './buddy-connection.entity';
import { BuddiesController } from './buddies.controller';
import { BuddiesService } from './buddies.service';

@Module({
    imports: [TypeOrmModule.forFeature([BuddyConnection]), UsersModule],
    controllers: [BuddiesController],
    providers: [BuddiesService],
})
export class BuddiesModule {}
