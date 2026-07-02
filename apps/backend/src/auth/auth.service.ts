import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './types/auth-response.type';
import { JwtPayload } from './types/jwt-payload.type';

const PASSWORD_HASH_ROUNDS = 10;

@Injectable()
export class AuthService {
    private readonly googleClientId: string | undefined;
    private readonly googleClient: OAuth2Client;

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        configService: ConfigService,
    ) {
        this.googleClientId = configService.get<string>('GOOGLE_CLIENT_ID');
        this.googleClient = new OAuth2Client(this.googleClientId);
    }

    async register(dto: RegisterDto): Promise<AuthResponse> {
        const email = dto.email.toLowerCase().trim();

        const existing = await this.usersService.findByEmail(email);
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
        const user = await this.usersService.create({ email, passwordHash });

        return this.buildAuthResponse(user);
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        const email = dto.email.toLowerCase().trim();

        const user = await this.usersService.findByEmailWithPassword(email);
        const isMatch = user?.passwordHash ? await bcrypt.compare(dto.password, user.passwordHash) : false;
        if (!user || !isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.buildAuthResponse(user);
    }

    async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
        const user = await this.usersService.findByIdWithPassword(userId);
        const isMatch = user?.passwordHash
            ? await bcrypt.compare(dto.currentPassword, user.passwordHash)
            : false;
        if (!user || !isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordHash = await bcrypt.hash(dto.newPassword, PASSWORD_HASH_ROUNDS);
        await this.usersService.updatePassword(user.id, passwordHash);
    }

    async loginWithGoogle(dto: GoogleAuthDto): Promise<AuthResponse> {
        const payload = await this.googleClient
            .verifyIdToken({ idToken: dto.idToken, audience: this.googleClientId })
            .then((ticket) => ticket.getPayload())
            .catch(() => undefined);

        if (!payload || !payload.email_verified || !payload.email) {
            throw new UnauthorizedException('Invalid Google token');
        }

        const email = payload.email.toLowerCase().trim();
        const googleId = payload.sub;
        const name = payload.name;
        const avatarUrl = payload.picture;

        const existingByGoogleId = await this.usersService.findByGoogleId(googleId);
        if (existingByGoogleId) {
            await this.usersService.updateGoogleProfile(existingByGoogleId.id, { name, avatarUrl });
            return this.buildAuthResponse({ ...existingByGoogleId, name: name ?? null, avatarUrl: avatarUrl ?? null });
        }

        const existingByEmail = await this.usersService.findByEmailWithPassword(email);
        if (existingByEmail) {
            await this.usersService.linkGoogleId(existingByEmail.id, googleId);
            await this.usersService.updateGoogleProfile(existingByEmail.id, { name, avatarUrl });
            return this.buildAuthResponse({
                ...existingByEmail,
                googleId,
                name: name ?? existingByEmail.name,
                avatarUrl: avatarUrl ?? existingByEmail.avatarUrl,
            });
        }

        const user = await this.usersService.create({ email, googleId, name, avatarUrl });
        return this.buildAuthResponse(user);
    }

    private buildAuthResponse(user: User): AuthResponse {
        const payload: JwtPayload = { sub: user.id, email: user.email };
        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                hasPassword: Boolean(user.passwordHash),
                name: user.name ?? null,
                avatarUrl: user.avatarUrl ?? null,
            },
        };
    }
}
