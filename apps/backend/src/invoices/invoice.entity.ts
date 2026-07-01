import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
@Unique(['userId', 'iic'])
export class Invoice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    iic: string;

    @Column({ type: 'jsonb' })
    data: Record<string, unknown>;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}
