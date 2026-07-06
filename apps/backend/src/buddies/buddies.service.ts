import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { BuddyConnection } from './buddy-connection.entity';

export type BuddySummary = {
    connectionId: string;
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
};

@Injectable()
export class BuddiesService {
    constructor(
        @InjectRepository(BuddyConnection)
        private readonly connectionsRepository: Repository<BuddyConnection>,
        private readonly usersService: UsersService,
    ) {}

    async sendRequest(userId: string, code: string): Promise<BuddyConnection> {
        const target = await this.usersService.findByCode(code);
        if (!target) {
            throw new NotFoundException('Nuk u gjet asnjë përdorues me këtë kod.');
        }
        if (target.id === userId) {
            throw new BadRequestException('Nuk mund të shtosh veten.');
        }

        const existing = await this.connectionsRepository.findOne({
            where: [
                { requesterId: userId, addresseeId: target.id },
                { requesterId: target.id, addresseeId: userId },
            ],
        });

        if (existing && existing.status !== 'rejected') {
            throw new BadRequestException('Ka tashmë një lidhje me këtë përdorues.');
        }

        if (existing) {
            await this.connectionsRepository.update(existing.id, {
                status: 'pending',
                requesterId: userId,
                addresseeId: target.id,
            });
            return { ...existing, status: 'pending', requesterId: userId, addresseeId: target.id };
        }

        const connection = this.connectionsRepository.create({
            requesterId: userId,
            addresseeId: target.id,
            status: 'pending',
        });
        return this.connectionsRepository.save(connection);
    }

    async listIncomingRequests(userId: string): Promise<BuddySummary[]> {
        const connections = await this.connectionsRepository.find({
            where: { addresseeId: userId, status: 'pending' },
            relations: ['requester'],
            order: { createdAt: 'DESC' },
        });
        return connections.map((connection) => this.toSummary(connection, connection.requester));
    }

    async respondToRequest(userId: string, requestId: string, accept: boolean): Promise<void> {
        const connection = await this.connectionsRepository.findOne({ where: { id: requestId } });
        if (!connection || connection.addresseeId !== userId) {
            throw new NotFoundException();
        }
        await this.connectionsRepository.update(requestId, { status: accept ? 'accepted' : 'rejected' });
    }

    async listBuddies(userId: string): Promise<BuddySummary[]> {
        const connections = await this.connectionsRepository.find({
            where: [
                { requesterId: userId, status: 'accepted' },
                { addresseeId: userId, status: 'accepted' },
            ],
            relations: ['requester', 'addressee'],
            order: { createdAt: 'DESC' },
        });
        return connections.map((connection) => {
            const other = connection.requesterId === userId ? connection.addressee : connection.requester;
            return this.toSummary(connection, other);
        });
    }

    private toSummary(connection: BuddyConnection, user: User): BuddySummary {
        return {
            connectionId: connection.id,
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
        };
    }
}
