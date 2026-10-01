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

export const PROJECT_CURRENCIES = ['ALL', 'EUR'] as const;
export type ProjectCurrency = (typeof PROJECT_CURRENCIES)[number];

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

    // What the project's budget is counted in, and what a new invoice filed
    // against it starts out in. Invoices themselves are always stored in lek.
    @Column({ type: 'varchar', default: 'ALL' })
    currency: ProjectCurrency;

    @Column({ type: 'varchar', nullable: true })
    startDate: string | null;

    @Column({ type: 'varchar', nullable: true })
    endDate: string | null;

    @Column({ type: 'text', array: true, default: '{}' })
    buddyIds: string[];

    @CreateDateColumn()
    createdAt: Date;
}
