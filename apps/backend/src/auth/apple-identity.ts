import { createPublicKey, verify, type JsonWebKeyInput } from 'crypto';

// Sign in with Apple hands the app an identity token: a JWT signed by Apple
// that says who the person is. It is checked here against Apple's published
// keys rather than trusted as sent - anyone can write a JWT with someone
// else's id in it.

const KEYS_URL = 'https://appleid.apple.com/auth/keys';
const ISSUER = 'https://appleid.apple.com';
const REQUEST_TIMEOUT_MS = 8000;
// Apple rotates its keys rarely. They are fetched again at most this often,
// and at once when a token names a key that is not among the ones held.
const KEYS_TTL_MS = 60 * 60 * 1000;

type AppleKey = JsonWebKeyInput['key'] & { kid: string };

export type AppleIdentity = {
    // Apple's stable id for this person within this app.
    appleId: string;
    // The person's address, or the relay address Apple made up for them when
    // they chose to hide it. Apple leaves it out of some later sign-ins.
    email: string | null;
};

let cachedKeys: { keys: AppleKey[]; fetchedAt: number } | null = null;

async function fetchKeys(): Promise<AppleKey[]> {
    const response = await fetch(KEYS_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`Apple keys answered ${response.status}`);
    }
    const body = (await response.json()) as { keys?: AppleKey[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    cachedKeys = { keys, fetchedAt: Date.now() };
    return keys;
}

async function findKey(kid: string): Promise<AppleKey | null> {
    if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_TTL_MS) {
        const held = cachedKeys.keys.find((key) => key.kid === kid);
        if (held) {
            return held;
        }
    }
    const fresh = await fetchKeys();
    return fresh.find((key) => key.kid === kid) ?? null;
}

function decodePart(part: string): Record<string, unknown> | null {
    try {
        const parsed: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

// Who an identity token is for, or null when it is not a token Apple issued to
// this app that is still in date. `audience` is the app's bundle identifier.
export async function verifyAppleIdentityToken(token: string, audience: string): Promise<AppleIdentity | null> {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = decodePart(headerPart);
    const payload = decodePart(payloadPart);
    if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') {
        return null;
    }

    let key: AppleKey | null;
    try {
        key = await findKey(header.kid);
    } catch {
        return null;
    }
    if (!key) {
        return null;
    }

    const isSignedByApple = verify(
        'RSA-SHA256',
        Buffer.from(`${headerPart}.${payloadPart}`),
        createPublicKey({ key, format: 'jwk' }),
        Buffer.from(signaturePart, 'base64url'),
    );
    if (!isSignedByApple) {
        return null;
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    if (payload.iss !== ISSUER || !audiences.includes(audience) || expiresAt <= Date.now()) {
        return null;
    }
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        return null;
    }

    const email = typeof payload.email === 'string' && payload.email.length > 0 ? payload.email : null;
    return { appleId: payload.sub, email: email ? email.toLowerCase().trim() : null };
}
