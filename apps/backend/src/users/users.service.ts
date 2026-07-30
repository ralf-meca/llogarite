import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

const CODE_CHARS = '0123456789';
const CODE_LENGTH = 6;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async setPremium(id: string, isPremium: boolean): Promise<void> {
        await this.usersRepository.update(id, { isPremium });
    }

    async deleteAccount(id: string): Promise<void> {
        await this.usersRepository.delete(id);
    }

    async setAvatar(id: string, image: string): Promise<void> {
        const base64 = image.slice(image.indexOf(',') + 1);
        const approxBytes = (base64.length * 3) / 4;
        if (approxBytes > MAX_AVATAR_BYTES) {
            throw new BadRequestException('Image is too large');
        }
        await this.usersRepository.update(id, { avatarUrl: image });
    }

    async removeAvatar(id: string): Promise<void> {
        await this.usersRepository.update(id, { avatarUrl: null });
    }

    async updatePushToken(id: string, pushToken: string | null): Promise<void> {
        await this.usersRepository.update(id, { pushToken });
    }

    findByCode(code: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { code: code.toUpperCase() } });
    }

    async ensureCode(userId: string): Promise<string> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        if (user.code) {
            return user.code;
        }

        for (let attempt = 0; attempt < 10; attempt++) {
            const code = generateCode();
            const existing = await this.usersRepository.findOne({ where: { code } });
            if (!existing) {
                await this.usersRepository.update(userId, { code });
                return code;
            }
        }
        throw new Error('Could not generate a unique code');
    }

    findByEmailWithPassword(email: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { email },
            select: {
                id: true,
                email: true,
                passwordHash: true,
                name: true,
                avatarUrl: true,
                isPremium: true,
                createdAt: true,
            },
        });
    }

    findByIdWithPassword(id: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { id },
            select: { id: true, email: true, passwordHash: true, createdAt: true },
        });
    }

    findByGoogleId(googleId: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { googleId },
            select: {
                id: true,
                email: true,
                passwordHash: true,
                googleId: true,
                name: true,
                avatarUrl: true,
                isPremium: true,
                createdAt: true,
            },
        });
    }

    create(input: {
        email: string;
        passwordHash?: string;
        googleId?: string;
        name?: string;
        avatarUrl?: string;
    }): Promise<User> {
        const user = this.usersRepository.create(input);
        return this.usersRepository.save(user);
    }

    async updatePassword(id: string, passwordHash: string): Promise<void> {
        await this.usersRepository.update(id, { passwordHash });
    }

    async linkGoogleId(id: string, googleId: string): Promise<void> {
        await this.usersRepository.update(id, { googleId });
    }

    async updateGoogleProfile(id: string, profile: { name?: string; avatarUrl?: string }): Promise<void> {
        await this.usersRepository.update(id, profile);
    }
}
