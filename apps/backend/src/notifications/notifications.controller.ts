import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    findAll(@CurrentUser() userId: string): Promise<Notification[]> {
        return this.notificationsService.findForUser(userId);
    }

    @Patch('read-all')
    markAllRead(@CurrentUser() userId: string): Promise<void> {
        return this.notificationsService.markAllRead(userId);
    }

    @Patch(':id/read')
    markRead(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.notificationsService.markRead(userId, id);
    }

    @Post('monthly-payment-reminder-sync')
    syncMonthlyPaymentReminder(
        @CurrentUser() userId: string,
        @Body() body: { paymentId: string; title: string; body: string },
    ): Promise<Notification> {
        return this.notificationsService.syncMonthlyPaymentReminder(userId, body);
    }
}
