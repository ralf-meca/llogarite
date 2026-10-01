import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export const PROJECT_KINDS = ['project', 'trip'] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

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

    // A trip is a project with a fixed span: it always has both dates, where
    // a plain project has no start and may never end.
    @Column({ type: 'varchar', default: 'project' })
    kind: ProjectKind;

    @Column({ type: 'varchar', nullable: true })
    startDate: string | null;

    @Column({ type: 'varchar', nullable: true })
    endDate: string | null;

    @Column({ type: 'text', array: true, default: '{}' })
    buddyIds: string[];

    @CreateDateColumn()
    createdAt: Date;
}
