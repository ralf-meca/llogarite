import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    async me(@CurrentUser() userId: string) {
        const code = await this.usersService.ensureCode(userId);
        return { code };
    }

    @Patch('me/push-token')
    updatePushToken(@CurrentUser() userId: string, @Body() body: { token: string | null }): Promise<void> {
        return this.usersService.updatePushToken(userId, body.token ?? null);
    }
}
