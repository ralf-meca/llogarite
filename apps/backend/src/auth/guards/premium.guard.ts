import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

// Same shape and the same reasoning as AdminGuard: behind JwtAuthGuard, and the
// flag comes from the database rather than the token.
//
// Premium is otherwise only enforced in the app, which means it is not really
// enforced at all. This does not fix that on its own - the projects, buddies
// and products endpoints still check nothing beyond the token - but a new
// endpoint serving a paid screen should not add to the pile.
@Injectable()
export class PremiumGuard implements CanActivate {
    constructor(private readonly usersService: UsersService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;
        if (!userId) {
            throw new ForbiddenException();
        }

        const user = await this.usersService.findById(userId);
        if (!user?.isPremium) {
            throw new ForbiddenException('Premium required');
        }
        return true;
    }
}
