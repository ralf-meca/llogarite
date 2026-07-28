import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RevenueCatWebhookPayload } from './revenuecat-webhook.dto';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Controller('webhooks/revenuecat')
export class RevenueCatWebhookController {
    constructor(
        private readonly revenueCatWebhookService: RevenueCatWebhookService,
        private readonly configService: ConfigService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async handle(
        @Headers('authorization') authorization: string | undefined,
        @Body() payload: RevenueCatWebhookPayload,
    ): Promise<void> {
        const secret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
        if (!secret || authorization !== `Bearer ${secret}`) {
            throw new ForbiddenException();
        }
        await this.revenueCatWebhookService.handleEvent(payload);
    }
}
