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

export const INVOICE_LEGITIMACIES = ['pending', 'accepted', 'denied'] as const;
export type InvoiceLegitimacy = (typeof INVOICE_LEGITIMACIES)[number];

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

    // Whether a reviewer has vouched for this invoice being a real receipt.
    // Only accepted ones feed the shared price comparison, so this gates what
    // other people are shown - never what the owner sees of their own.
    @Column({ type: 'varchar', default: 'pending' })
    legitimacy: InvoiceLegitimacy;

    @CreateDateColumn()
    createdAt: Date;
}
