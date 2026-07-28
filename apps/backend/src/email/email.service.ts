import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;

    constructor(configService: ConfigService) {
        this.from = configService.get<string>('SMTP_FROM') ?? 'Llogarite <no-reply@llogarite.app>';
        this.transporter = nodemailer.createTransport({
            host: configService.get<string>('SMTP_HOST'),
            port: Number(configService.get<string>('SMTP_PORT') ?? 587),
            secure: configService.get<string>('SMTP_SECURE') === 'true',
            auth: {
                user: configService.get<string>('SMTP_USER'),
                pass: configService.get<string>('SMTP_PASSWORD'),
            },
        });
    }

    async sendMail(to: string, subject: string, html: string): Promise<void> {
        try {
            await this.transporter.sendMail({ from: this.from, to, subject, html });
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
        }
    }
}
