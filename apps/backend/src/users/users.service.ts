import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    findByEmailWithPassword(email: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { email },
            select: { id: true, email: true, passwordHash: true, createdAt: true },
        });
    }

    findByIdWithPassword(id: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { id },
            select: { id: true, email: true, passwordHash: true, createdAt: true },
        });
    }

    findByGoogleId(googleId: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { googleId } });
    }

    create(input: { email: string; passwordHash?: string; googleId?: string }): Promise<User> {
        const user = this.usersRepository.create(input);
        return this.usersRepository.save(user);
    }

    async updatePassword(id: string, passwordHash: string): Promise<void> {
        await this.usersRepository.update(id, { passwordHash });
    }

    async linkGoogleId(id: string, googleId: string): Promise<void> {
        await this.usersRepository.update(id, { googleId });
    }
}
