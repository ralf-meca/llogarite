import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class BuddyConnection {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    requesterId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requesterId' })
    requester: User;

    @Column()
    addresseeId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'addresseeId' })
    addressee: User;

    @Column({ default: 'pending' })
    status: string;

    @CreateDateColumn()
    createdAt: Date;
}
