import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Budget {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'double precision' })
    amount: number;

    @Column({ type: 'jsonb', nullable: true })
    categoryAllocations: Record<string, { mode: 'percent' | 'amount'; value: number }> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
