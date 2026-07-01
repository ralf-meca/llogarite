import { Body, Controller, Get, Post } from '@nestjs/common';
import { Invoice } from './invoice.entity';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
    constructor(private readonly invoicesService: InvoicesService) {}

    @Post()
    create(@Body() data: Record<string, unknown>): Promise<Invoice> {
        return this.invoicesService.create(data);
    }

    @Get()
    findAll(): Promise<Invoice[]> {
        return this.invoicesService.findAll();
    }
}
