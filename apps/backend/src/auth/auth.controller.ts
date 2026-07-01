import { Body, Controller, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
}
