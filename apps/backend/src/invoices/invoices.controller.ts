import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Invoice } from './invoice.entity';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
    constructor(private readonly invoicesService: InvoicesService) {}

    @Post()
    create(@CurrentUser() userId: string, @Body() data: Record<string, unknown>): Promise<Invoice> {
        return this.invoicesService.create(userId, data);
    }

    @Get()
    findAll(@CurrentUser() userId: string): Promise<Invoice[]> {
        return this.invoicesService.findAll(userId);
    }

    @Get('owed-by-me')
    findOwedByMe(@CurrentUser() userId: string): Promise<Invoice[]> {
        return this.invoicesService.findOwedByMe(userId);
    }

    @Patch(':id')
    update(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() data: Record<string, unknown>,
    ): Promise<Invoice> {
        return this.invoicesService.update(userId, id, data);
    }

    @Patch(':id/buddy-paid')
    setBuddyPaid(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() body: { buddyUserId: string; paid: boolean },
    ): Promise<Invoice> {
        return this.invoicesService.setBuddyPaid(userId, id, body.buddyUserId, body.paid);
    }

    @Post(':id/notify-paid')
    notifyPaid(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.invoicesService.notifyPaid(userId, id);
    }

    @Delete(':id')
    remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.invoicesService.remove(userId, id);
    }
}
