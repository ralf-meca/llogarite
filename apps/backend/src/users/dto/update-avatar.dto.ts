import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateAvatarDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/, {
        message: 'image must be a base64-encoded PNG, JPEG, or WEBP data URI',
    })
    image: string;
}
