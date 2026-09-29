import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { INVOICE_LEGITIMACIES, type InvoiceLegitimacy } from '../invoices/invoice.entity';
import { AdminService, type ReviewInvoice } from './admin.service';

function asLegitimacy(value: unknown): InvoiceLegitimacy {
    if (typeof value !== 'string' || !INVOICE_LEGITIMACIES.includes(value as InvoiceLegitimacy)) {
        throw new BadRequestException(`legitimacy must be one of ${INVOICE_LEGITIMACIES.join(', ')}`);
    }
    return value as InvoiceLegitimacy;
}

@Controller('admin/invoices')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    // Defaults to pending: the reason to open this screen is the queue, and
    // anything already decided is the exception you go looking for.
    @Get()
    findAll(@Query('status') status?: string): Promise<ReviewInvoice[]> {
        return this.adminService.findByLegitimacy(status === undefined ? 'pending' : asLegitimacy(status));
    }

    @Patch(':id/legitimacy')
    @HttpCode(HttpStatus.OK)
    setLegitimacy(@Param('id') id: string, @Body() body: { legitimacy?: unknown }): Promise<void> {
        return this.adminService.setLegitimacy(id, asLegitimacy(body?.legitimacy));
    }
}
