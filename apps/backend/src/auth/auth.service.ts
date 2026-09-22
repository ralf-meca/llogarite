import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { loginCodeEmailHtml } from '../email/templates/login-code.template';
import { passwordResetEmailHtml } from '../email/templates/password-reset.template';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestCodeDto } from './dto/request-code.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { LoginCode } from './login-code.entity';
import { AuthResponse } from './types/auth-response.type';
import { JwtPayload } from './types/jwt-payload.type';

const PASSWORD_HASH_ROUNDS = 10;
const CODE_LENGTH = 6;
const LOGIN_CODE_TTL_MINUTES = 10;
const LOGIN_CODE_MAX_ATTEMPTS = 5;

// crypto rather than Math.random: each of these codes is a credential on its own.
function generateNumericCode(): string {
    const min = 10 ** (CODE_LENGTH - 1);
    const max = 10 ** CODE_LENGTH;
    return String(randomInt(min, max));
}

@Injectable()
export class AuthService {
    private readonly googleClientId: string | undefined;
    private readonly googleClient: OAuth2Client;

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService,
        @InjectRepository(LoginCode)
        private readonly loginCodesRepository: Repository<LoginCode>,
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
        const user = await this.usersService.create({ email, passwordHash, name: dto.name.trim() });

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

    async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
        const email = dto.email.toLowerCase().trim();
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            // Don't reveal whether an account exists for this email.
            return;
        }

        const code = generateNumericCode();
        const passwordHash = await bcrypt.hash(code, PASSWORD_HASH_ROUNDS);
        await this.usersService.updatePassword(user.id, passwordHash);

        await this.emailService.sendMail(
            user.email,
            'Fjalëkalimi yt i përkohshëm - Llogarite',
            passwordResetEmailHtml(code),
        );
    }

    async requestLoginCode(dto: RequestCodeDto): Promise<void> {
        const email = dto.email.toLowerCase().trim();

        // A new request retires whatever code was still outstanding for this email.
        await this.loginCodesRepository.update({ email, consumed: false }, { consumed: true });

        const code = generateNumericCode();
        const codeHash = await bcrypt.hash(code, PASSWORD_HASH_ROUNDS);
        await this.loginCodesRepository.save(
            this.loginCodesRepository.create({
                email,
                codeHash,
                expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60 * 1000),
            }),
        );

        await this.emailService.sendMailOrThrow(
            email,
            'Kodi yt i kyçjes - Llogarite',
            loginCodeEmailHtml(code, LOGIN_CODE_TTL_MINUTES),
        );
    }

    async verifyLoginCode(dto: VerifyCodeDto): Promise<AuthResponse> {
        const email = dto.email.toLowerCase().trim();

        const record = await this.loginCodesRepository.findOne({
            where: { email, consumed: false },
            order: { createdAt: 'DESC' },
        });
        // One message for every failure, so a wrong code can't be told apart
        // from an email that was never sent one.
        if (!record || record.expiresAt.getTime() < Date.now()) {
            throw new UnauthorizedException('Invalid or expired code');
        }

        if (record.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
            // Burn it instead of leaving it guessable for the rest of its life.
            await this.loginCodesRepository.update(record.id, { consumed: true });
            throw new UnauthorizedException('Invalid or expired code');
        }

        const isMatch = await bcrypt.compare(dto.code, record.codeHash);
        if (!isMatch) {
            await this.loginCodesRepository.increment({ id: record.id }, 'attempts', 1);
            throw new UnauthorizedException('Invalid or expired code');
        }

        await this.loginCodesRepository.update(record.id, { consumed: true });

        // A first successful code is what creates the account; the name stays
        // empty until the user fills it in from their profile.
        const existing = await this.usersService.findByEmailWithPassword(email);
        const user = existing ?? (await this.usersService.create({ email }));

        return this.buildAuthResponse(user);
    }

    async setPassword(userId: string, dto: SetPasswordDto): Promise<void> {
        const user = await this.usersService.findByIdWithPassword(userId);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        // Replacing a password that already exists has to go through
        // changePassword, which proves the caller knows the current one.
        if (user.passwordHash) {
            throw new ConflictException('Password already set');
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
                isPremium: Boolean(user.isPremium),
            },
        };
    }
}
