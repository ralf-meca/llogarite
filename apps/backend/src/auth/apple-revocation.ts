import { createPrivateKey, sign } from 'crypto';

// Apple asks that an app offering Sign in with Apple also withdraws Apple's
// grant when the account is deleted, so the person's Apple ID no longer lists
// the app. That takes a token Apple hands over at sign-in and a secret signed
// with a key from the developer account.
//
// The key lives in the server's environment. Until it is put there this file
// does nothing at all: sign-in works without it, and deleting an account just
// deletes it.

const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const AUDIENCE = 'https://appleid.apple.com';
const REQUEST_TIMEOUT_MS = 8000;
const SECRET_LIFETIME_SECONDS = 5 * 60;

export type AppleRevocationConfig = {
    // The developer account's team id.
    teamId: string;
    // The id of the Sign in with Apple key.
    keyId: string;
    // The key itself: the contents of its .p8 file.
    privateKey: string;
    // The app's bundle identifier.
    clientId: string;
};

type ConfigReader = { get<T = string>(name: string): T | undefined };

// Null unless every part is set, so a half-filled environment turns the
// feature off rather than failing each sign-in.
export function readAppleRevocationConfig(config: ConfigReader, clientId: string): AppleRevocationConfig | null {
    const teamId = config.get<string>('APPLE_TEAM_ID');
    const keyId = config.get<string>('APPLE_KEY_ID');
    const privateKey = config.get<string>('APPLE_PRIVATE_KEY');
    if (!teamId || !keyId || !privateKey) {
        return null;
    }
    // An env file holds the key on one line, its line breaks written as \n.
    return { teamId, keyId, privateKey: privateKey.replace(/\\n/g, '\n'), clientId };
}

// The short-lived JWT Apple accepts in place of a client secret.
function clientSecret(config: AppleRevocationConfig): string {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: 'ES256', kid: config.keyId })}.${encode({
        iss: config.teamId,
        iat: now,
        exp: now + SECRET_LIFETIME_SECONDS,
        aud: AUDIENCE,
        sub: config.clientId,
    })}`;
    const signature = sign('sha256', Buffer.from(unsigned), {
        key: createPrivateKey(config.privateKey),
        dsaEncoding: 'ieee-p1363',
    });
    return `${unsigned}.${signature.toString('base64url')}`;
}

async function post(url: string, fields: Record<string, string>): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

// Trades the one-time code from a sign-in for the long-lived token that can be
// revoked later. Null when Apple will not give one; the sign-in stands anyway.
export async function exchangeAppleAuthorizationCode(
    config: AppleRevocationConfig,
    authorizationCode: string,
): Promise<string | null> {
    try {
        const response = await post(TOKEN_URL, {
            client_id: config.clientId,
            client_secret: clientSecret(config),
            code: authorizationCode,
            grant_type: 'authorization_code',
        });
        if (!response.ok) {
            return null;
        }
        const body = (await response.json()) as { refresh_token?: unknown };
        return typeof body.refresh_token === 'string' ? body.refresh_token : null;
    } catch {
        return null;
    }
}

// Withdraws the grant. True when Apple accepted it.
export async function revokeAppleToken(config: AppleRevocationConfig, refreshToken: string): Promise<boolean> {
    try {
        const response = await post(REVOKE_URL, {
            client_id: config.clientId,
            client_secret: clientSecret(config),
            token: refreshToken,
            token_type_hint: 'refresh_token',
        });
        return response.ok;
    } catch {
        return false;
    }
}
