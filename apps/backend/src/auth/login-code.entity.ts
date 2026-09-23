import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class LoginCode {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Held against the email rather than a user id, because the account may not
    // exist yet — a first successful code is what creates it.
    @Index()
    @Column()
    email: string;

    // Only the hash is stored, so a database read can't reveal a live code.
    @Column()
    codeHash: string;

    @Column({ type: 'timestamptz' })
    expiresAt: Date;

    @Column({ default: 0 })
    attempts: number;

    @Column({ default: false })
    consumed: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
