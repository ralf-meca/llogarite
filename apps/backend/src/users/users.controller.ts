import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
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

    @Delete('me')
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteMe(@CurrentUser() userId: string): Promise<void> {
        return this.usersService.deleteAccount(userId);
    }

    @Patch('me/avatar')
    async updateAvatar(
        @CurrentUser() userId: string,
        @Body() body: UpdateAvatarDto,
    ): Promise<{ avatarUrl: string | null }> {
        await this.usersService.setAvatar(userId, body.image);
        return { avatarUrl: body.image };
    }

    @Delete('me/avatar')
    async removeAvatar(@CurrentUser() userId: string): Promise<{ avatarUrl: string | null }> {
        await this.usersService.removeAvatar(userId);
        return { avatarUrl: null };
    }
}
