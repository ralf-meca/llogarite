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
export class MonthlyPayment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    name: string;

    @Column({ type: 'double precision' })
    amount: number;

    @Column({ type: 'int' })
    dueDay: number;

    @Column({ type: 'varchar', nullable: true })
    lastPaidMonth: string | null;

    @Column({ type: 'text', array: true, default: '{}' })
    buddyIds: string[];

    @CreateDateColumn()
    createdAt: Date;
}
