import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class DiscountCode {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    code: string;

    @Column({ type: 'int' })
    discountPercent: number;

    @Column({ nullable: true })
    email: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
