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

    @Patch(':id')
    update(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() data: Record<string, unknown>,
    ): Promise<Invoice> {
        return this.invoicesService.update(userId, id, data);
    }

    @Delete(':id')
    remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
        return this.invoicesService.remove(userId, id);
    }
}
