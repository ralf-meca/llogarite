import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hasUnsettledDebtWith } from '../invoices/invoice-debts';
import { Invoice } from '../invoices/invoice.entity';
import { NotificationsService } from '../notifications/notifications.service';
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
        @InjectRepository(Invoice)
        private readonly invoicesRepository: Repository<Invoice>,
        private readonly usersService: UsersService,
        private readonly notificationsService: NotificationsService,
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
            await this.notifyBuddyRequest(userId, target);
            return { ...existing, status: 'pending', requesterId: userId, addresseeId: target.id };
        }

        const connection = this.connectionsRepository.create({
            requesterId: userId,
            addresseeId: target.id,
            status: 'pending',
        });
        const saved = await this.connectionsRepository.save(connection);
        await this.notifyBuddyRequest(userId, target);
        return saved;
    }

    private async notifyBuddyRequest(requesterId: string, target: User): Promise<void> {
        const requester = await this.usersService.findById(requesterId);
        await this.notificationsService.notify(target.id, target.pushToken, {
            type: 'buddy_request',
            title: 'Kërkesë e re',
            body: `${requester?.name ?? requester?.email ?? 'Dikush'} dëshiron të shtohet si shok shpenzimesh.`,
            data: { buddyId: requesterId },
        });
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

    // Either side can end a connection, but only once the two are square: with
    // money still owed between them, removing the buddy would leave a debt
    // nobody can see who to chase for. The message is written for the person
    // reading it, and the app shows it as it comes.
    //
    // The row goes rather than being marked, so the two can connect again later
    // like strangers would. Invoices and projects already shared stay as they are.
    async removeBuddy(userId: string, connectionId: string): Promise<void> {
        const connection = await this.connectionsRepository.findOne({ where: { id: connectionId } });
        const isParty = connection && (connection.requesterId === userId || connection.addresseeId === userId);
        if (!connection || !isParty || connection.status !== 'accepted') {
            throw new NotFoundException();
        }
        const otherId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId;
        if (await this.hasUnsettledInvoices(userId, otherId)) {
            throw new ConflictException(
                'Nuk mund ta heqësh këtë shok: keni ende fatura të papaguara mes jush. Paguajini fillimisht.',
            );
        }
        await this.connectionsRepository.delete(connectionId);
    }

    // Whether either of the two still owes the other on any invoice they share:
    // one of them entered it and the other is a buddy on it.
    private async hasUnsettledInvoices(firstId: string, secondId: string): Promise<boolean> {
        // The buddy ids take parameters of their own: the owner column is a
        // uuid and the ids inside the JSON are text.
        const onInvoice = (param: string) =>
            `EXISTS (SELECT 1 FROM jsonb_array_elements(` +
            `CASE WHEN jsonb_typeof(invoice.data->'buddies') = 'array' THEN invoice.data->'buddies' ELSE '[]'::jsonb END` +
            `) AS b WHERE b->>'userId' = :${param})`;
        const invoices = await this.invoicesRepository
            .createQueryBuilder('invoice')
            .where(`(invoice.userId = :firstId AND ${onInvoice('secondText')})`, { firstId, secondText: secondId })
            .orWhere(`(invoice.userId = :secondId AND ${onInvoice('firstText')})`, { secondId, firstText: firstId })
            .getMany();

        return invoices.some((invoice) =>
            hasUnsettledDebtWith(invoice.data, invoice.userId === firstId ? secondId : firstId),
        );
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
