import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BuddiesService, BuddySummary } from './buddies.service';

@Controller('buddies')
@UseGuards(JwtAuthGuard)
export class BuddiesController {
    constructor(private readonly buddiesService: BuddiesService) {}

    @Post('request')
    sendRequest(@CurrentUser() userId: string, @Body() body: { code: string }) {
        if (!body.code || typeof body.code !== 'string') {
            throw new BadRequestException('code is required');
        }
        return this.buddiesService.sendRequest(userId, body.code);
    }

    @Get('requests')
    listRequests(@CurrentUser() userId: string): Promise<BuddySummary[]> {
        return this.buddiesService.listIncomingRequests(userId);
    }

    @Patch('requests/:id')
    respondToRequest(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() body: { accept: boolean },
    ): Promise<void> {
        return this.buddiesService.respondToRequest(userId, id, body.accept === true);
    }

    @Get()
    listBuddies(@CurrentUser() userId: string): Promise<BuddySummary[]> {
        return this.buddiesService.listBuddies(userId);
    }
}
