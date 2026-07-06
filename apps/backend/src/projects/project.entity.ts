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
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    name: string;

    @Column({ type: 'text', nullable: true })
    details: string | null;

    @Column({ type: 'double precision' })
    budget: number;

    @Column({ type: 'varchar', nullable: true })
    endDate: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
