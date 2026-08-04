import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    type: string;

    @Column()
    title: string;

    @Column()
    body: string;

    @Column({ type: 'jsonb', nullable: true })
    data: Record<string, unknown> | null;

    @Column({ default: false })
    read: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
