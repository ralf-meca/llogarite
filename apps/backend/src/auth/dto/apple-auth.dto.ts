import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleAuthDto {
    @IsString()
    @IsNotEmpty()
    identityToken: string;

    // Apple gives the app the person's name once, on their first sign-in, and
    // never puts it in the token - so the app passes it along when it has it.
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    // The one-time code that comes with the token. Traded for what is needed
    // to withdraw Apple's grant if the account is ever deleted.
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    authorizationCode?: string;
}
