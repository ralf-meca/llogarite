import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

type PushMessage = {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    badge?: number;
};

type NotifyParams = {
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly expo = new Expo();

    constructor(
        @InjectRepository(Notification)
        private readonly notificationsRepository: Repository<Notification>,
    ) {}

    // Persists a Notification row for in-app history, then best-effort pushes it to the
    // device. The saved row's id is included in the push payload so a tap on the OS-level
    // notification can mark that same row as read.
    async notify(userId: string, pushToken: string | null | undefined, params: NotifyParams): Promise<Notification> {
        const notification = this.notificationsRepository.create({
            userId,
            type: params.type,
            title: params.title,
            body: params.body,
            data: params.data ?? null,
            read: false,
        });
        const saved = await this.notificationsRepository.save(notification);
        // The app-icon badge is driven by this push payload so it reflects the unread count
        // even if the app is never opened to run its own badge-syncing code.
        const unreadCount = await this.notificationsRepository.count({ where: { userId, read: false } });
        await this.send(pushToken, {
            title: params.title,
            body: params.body,
            data: { ...(params.data ?? {}), type: params.type, notificationId: saved.id },
            badge: unreadCount,
        });
        return saved;
    }

    findForUser(userId: string): Promise<Notification[]> {
        return this.notificationsRepository.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    }

    async markRead(userId: string, id: string): Promise<void> {
        await this.notificationsRepository.update({ id, userId }, { read: true });
    }

    async markAllRead(userId: string): Promise<void> {
        await this.notificationsRepository.update({ userId, read: false }, { read: true });
    }

    // Best-effort record of a locally-scheduled monthly-payment reminder that just fired or
    // was tapped on-device. Deduped by (userId, paymentId, same calendar day) so a fire-time
    // sync followed by a tap-time sync doesn't create two rows.
    async syncMonthlyPaymentReminder(
        userId: string,
        params: { paymentId: string; title: string; body: string },
    ): Promise<Notification> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const existing = await this.notificationsRepository
            .createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .andWhere("n.type = 'monthly_payment_reminder'")
            .andWhere("n.data->>'paymentId' = :paymentId", { paymentId: params.paymentId })
            .andWhere('n.createdAt >= :startOfDay', { startOfDay })
            .getOne();
        if (existing) {
            return existing;
        }
        const notification = this.notificationsRepository.create({
            userId,
            type: 'monthly_payment_reminder',
            title: params.title,
            body: params.body,
            data: { paymentId: params.paymentId },
            read: false,
        });
        return this.notificationsRepository.save(notification);
    }

    private async send(pushToken: string | null | undefined, message: PushMessage): Promise<void> {
        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            return;
        }
        const ticket: ExpoPushMessage = {
            to: pushToken,
            sound: 'default',
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            ...(message.badge !== undefined ? { badge: message.badge } : {}),
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
