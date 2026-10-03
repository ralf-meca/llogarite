import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';

@Module({
    imports: [TypeOrmModule.forFeature([ExchangeRate])],
    controllers: [ExchangeRatesController],
    providers: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
