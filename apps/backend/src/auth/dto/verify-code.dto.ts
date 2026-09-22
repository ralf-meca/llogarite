import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
    @IsEmail()
    email: string;

    @IsString()
    @Length(6, 6)
    @Matches(/^[0-9]+$/, { message: 'code must be numeric' })
    code: string;
}
