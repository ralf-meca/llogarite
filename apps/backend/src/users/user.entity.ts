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

    // Apple's id for the person, from Sign in with Apple.
    @Column({ type: 'varchar', unique: true, nullable: true })
    appleId: string | null;

    // What Apple gave at sign-in for withdrawing its grant when the account is
    // deleted. Never read out with the rest of the user.
    @Column({ type: 'varchar', select: false, nullable: true })
    appleRefreshToken: string | null;

    @Column({ nullable: true })
    name: string | null;

    @Column({ nullable: true })
    avatarUrl: string | null;

    @Column({ unique: true, nullable: true })
    code: string | null;

    @Column({ nullable: true })
    pushToken: string | null;

    @Column({ default: false })
    isPremium: boolean;

    // Set by hand in the database; there is no route that grants it.
    @Column({ default: false })
    isAdmin: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
