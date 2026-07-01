import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Invoice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    iic: string;

    @Column({ type: 'jsonb' })
    data: Record<string, unknown>;

    @CreateDateColumn()
    createdAt: Date;
}
