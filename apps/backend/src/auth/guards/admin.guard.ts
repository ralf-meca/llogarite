import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

// Runs behind JwtAuthGuard, which has already put the user on the request.
//
// The flag is read from the database rather than the token on purpose: tokens
// here last about a month, so a token minted before the flag was granted - or
// after it was taken away - must not be what decides this.
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly usersService: UsersService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;
        if (!userId) {
            throw new ForbiddenException();
        }

        const user = await this.usersService.findById(userId);
        if (!user?.isAdmin) {
            throw new ForbiddenException();
        }
        return true;
    }
}
