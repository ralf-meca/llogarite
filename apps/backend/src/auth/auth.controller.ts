import { Body, Controller, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestCodeDto } from './dto/request-code.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthResponse } from './types/auth-response.type';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() dto: RegisterDto): Promise<AuthResponse> {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto): Promise<AuthResponse> {
        return this.authService.login(dto);
    }

    // Sending costs an email against a finite quota that every sign-in now
    // depends on, so cap how many one address can ask for. Kept loose on
    // purpose: mobile carriers here put many real users behind one address, and
    // locking them out would be worse than the abuse this deters. The per-email
    // cooldown in the service is what stops a single inbox being flooded.
    @Post('request-code')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 600_000 } })
    requestLoginCode(@Body() dto: RequestCodeDto): Promise<void> {
        return this.authService.requestLoginCode(dto);
    }

    // Guessing is already capped at five tries per code; this is the ceiling on
    // spreading those guesses across many addresses at once.
    @Post('verify-code')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 30, ttl: 600_000 } })
    verifyLoginCode(@Body() dto: VerifyCodeDto): Promise<AuthResponse> {
        return this.authService.verifyLoginCode(dto);
    }

    @Post('set-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    setPassword(@CurrentUser() userId: string, @Body() dto: SetPasswordDto): Promise<void> {
        return this.authService.setPassword(userId, dto);
    }

    @Post('google')
    @HttpCode(HttpStatus.OK)
    loginWithGoogle(@Body() dto: GoogleAuthDto): Promise<AuthResponse> {
        return this.authService.loginWithGoogle(dto);
    }

    @Patch('password')
    @UseGuards(JwtAuthGuard)
    changePassword(@CurrentUser() userId: string, @Body() dto: ChangePasswordDto): Promise<void> {
        return this.authService.changePassword(userId, dto);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
        return this.authService.forgotPassword(dto);
    }
}
