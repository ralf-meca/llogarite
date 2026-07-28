import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Module({
    imports: [UsersModule],
    controllers: [RevenueCatWebhookController],
    providers: [RevenueCatWebhookService],
})
export class RevenueCatWebhookModule {}
