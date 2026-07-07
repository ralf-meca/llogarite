import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { DiscountCode } from './discount-code.entity';

export type RedeemDiscountCodeResult = {
    discountPercent: number;
    isPremium: boolean;
};

const FULL_DISCOUNT_PERCENT = 100;

@Injectable()
export class DiscountCodesService {
    constructor(
        @InjectRepository(DiscountCode)
        private readonly discountCodesRepository: Repository<DiscountCode>,
        private readonly usersService: UsersService,
    ) {}

    async redeem(userId: string, rawCode: string): Promise<RedeemDiscountCodeResult> {
        const code = rawCode.trim().toUpperCase();
        const discountCode = await this.discountCodesRepository.findOne({ where: { code } });
        if (!discountCode) {
            throw new NotFoundException('Kodi nuk ekziston.');
        }
        if (discountCode.email) {
            throw new BadRequestException('Ky kod është përdorur tashmë.');
        }

        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new NotFoundException('Përdoruesi nuk u gjet.');
        }

        await this.discountCodesRepository.update(discountCode.id, { email: user.email });

        if (discountCode.discountPercent >= FULL_DISCOUNT_PERCENT) {
            await this.usersService.setPremium(userId, true);
            return { discountPercent: discountCode.discountPercent, isPremium: true };
        }

        return { discountPercent: discountCode.discountPercent, isPremium: user.isPremium };
    }
}
