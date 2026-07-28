import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

type PushMessage = {
    title: string;
    body: string;
    data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly expo = new Expo();

    async send(pushToken: string | null | undefined, message: PushMessage): Promise<void> {
        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            return;
        }
        const ticket: ExpoPushMessage = {
            to: pushToken,
            sound: 'default',
            title: message.title,
            body: message.body,
            data: message.data ?? {},
        };
        try {
            const tickets = await this.expo.sendPushNotificationsAsync([ticket]);
            for (const result of tickets) {
                if (result.status === 'error') {
                    this.logger.warn(`Push notification rejected: ${result.message} (${result.details?.error})`);
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to send push notification: ${(error as Error).message}`);
        }
    }
}
