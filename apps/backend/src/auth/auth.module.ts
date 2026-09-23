import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { resolveClientIp } from './client-ip';
import { LoginCode } from './login-code.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
    imports: [
        UsersModule,
        EmailModule,
        PassportModule,
        TypeOrmModule.forFeature([LoginCode]),
        ThrottlerModule.forRoot({
            throttlers: [{ name: 'default', limit: 10, ttl: 600_000 }],
            getTracker: (req) => resolveClientIp(req),
        }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '30d') as unknown as StringValue,
                },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
