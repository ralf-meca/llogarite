import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { BuddyConnection } from './buddy-connection.entity';
import { BuddiesController } from './buddies.controller';
import { BuddiesService } from './buddies.service';

@Module({
    imports: [TypeOrmModule.forFeature([BuddyConnection]), UsersModule, NotificationsModule],
    controllers: [BuddiesController],
    providers: [BuddiesService],
})
export class BuddiesModule {}
