import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { Project } from '../projects/project.entity';
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

    @Column({ nullable: true })
    projectId: string | null;

    @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'projectId' })
    project: Project | null;

    @Column({ default: false })
    verified: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
