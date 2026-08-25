import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RevenueCatWebhookPayload } from './revenuecat-webhook.dto';

const PREMIUM_GRANTING_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const PREMIUM_REVOKING_EVENTS = new Set(['EXPIRATION']);

// RevenueCat identifies users as "$RCAnonymousID:..." until the app calls logIn,
// and it also sends test events with placeholder ids. Our ids are uuids, and
// handing anything else to a uuid column throws rather than returning null — so
// the "unknown user" branch below would never be reached, and RevenueCat would
// retry the resulting 500 indefinitely.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RevenueCatWebhookService {
    private readonly logger = new Logger(RevenueCatWebhookService.name);

    constructor(private readonly usersService: UsersService) {}

    async handleEvent(payload: RevenueCatWebhookPayload): Promise<void> {
        const event = payload?.event;
        if (!event?.app_user_id) {
            return;
        }

        if (!UUID_PATTERN.test(event.app_user_id)) {
            this.logger.warn(`Ignoring RevenueCat event for non-user id ${event.app_user_id}`);
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
