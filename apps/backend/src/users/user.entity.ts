import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ select: false, nullable: true })
    passwordHash: string | null;

    @Column({ unique: true, nullable: true })
    googleId: string | null;

    @Column({ nullable: true })
    name: string | null;

    @Column({ nullable: true })
    avatarUrl: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
