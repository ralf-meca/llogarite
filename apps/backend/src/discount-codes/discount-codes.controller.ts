import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscountCodesService, type RedeemDiscountCodeResult } from './discount-codes.service';
import { RedeemDiscountCodeDto } from './dto/redeem-discount-code.dto';

@Controller('discount-codes')
@UseGuards(JwtAuthGuard)
export class DiscountCodesController {
    constructor(private readonly discountCodesService: DiscountCodesService) {}

    @Post('redeem')
    @HttpCode(HttpStatus.OK)
    redeem(
        @CurrentUser() userId: string,
        @Body() dto: RedeemDiscountCodeDto,
    ): Promise<RedeemDiscountCodeResult> {
        return this.discountCodesService.redeem(userId, dto.code);
    }
}
