import {Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import {AppController} from './app.controller';
import {AuthModule} from './auth/auth.module';
import {BuddiesModule} from './buddies/buddies.module';
import {BudgetModule} from './budget/budget.module';
import {InvoicesModule} from './invoices/invoices.module';
import {MonthlyPaymentsModule} from './monthly-payments/monthly-payments.module';
import {ProjectsModule} from './projects/projects.module';
import {UsersModule} from './users/users.module';

@Module({
    controllers: [AppController],
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DATABASE_HOST'),
                port: +configService.get('DATABASE_PORT'),
                username: configService.get('DATABASE_USER'),
                password: configService.get('DATABASE_PASSWORD'),
                database: configService.get('DATABASE_NAME'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: true, // disable in production
            }),
            inject: [ConfigService],
        }),
        InvoicesModule,
        BudgetModule,
        MonthlyPaymentsModule,
        ProjectsModule,
        BuddiesModule,
        UsersModule,
        AuthModule,
    ],
})
export class AppModule {
}