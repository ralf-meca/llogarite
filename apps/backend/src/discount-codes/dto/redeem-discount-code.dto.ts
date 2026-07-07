import { IsNotEmpty, IsString } from 'class-validator';

export class RedeemDiscountCodeDto {
    @IsString()
    @IsNotEmpty()
    code: string;
}
