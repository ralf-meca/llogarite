import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// One day's rate for one currency, kept once it is known. The Bank of Albania
// only shows the latest fixing where it can be read reliably, so each one is
// written down as it is seen - that is how a rate for a past day can still be
// answered later, and how a restart does not forget them.
@Entity()
@Unique(['base', 'date'])
export class ExchangeRate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The foreign currency, e.g. EUR. The rate is always in lek per one unit.
    @Column({ type: 'varchar' })
    base: string;

    // YYYY-MM-DD.
    @Column({ type: 'varchar' })
    date: string;

    @Column({ type: 'double precision' })
    rate: number;

    // Where the figure came from: 'bank-of-albania', or the fallback's name.
    @Column({ type: 'varchar' })
    source: string;

    @CreateDateColumn()
    createdAt: Date;
}
