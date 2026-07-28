import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RevenueCatWebhookPayload } from './revenuecat-webhook.dto';

const PREMIUM_GRANTING_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const PREMIUM_REVOKING_EVENTS = new Set(['EXPIRATION']);

@Injectable()
export class RevenueCatWebhookService {
    private readonly logger = new Logger(RevenueCatWebhookService.name);

    constructor(private readonly usersService: UsersService) {}

    async handleEvent(payload: RevenueCatWebhookPayload): Promise<void> {
        const event = payload?.event;
        if (!event?.app_user_id) {
            return;
        }

        const user = await this.usersService.findById(event.app_user_id);
        if (!user) {
            this.logger.warn(`Received RevenueCat event for unknown user ${event.app_user_id}`);
            return;
        }

        if (PREMIUM_GRANTING_EVENTS.has(event.type)) {
            await this.usersService.setPremium(user.id, true);
        } else if (PREMIUM_REVOKING_EVENTS.has(event.type)) {
            await this.usersService.setPremium(user.id, false);
        }
    }
}
