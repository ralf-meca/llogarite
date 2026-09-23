// Every request reaches this backend through the Cloudflare Tunnel, so the
// socket address is the tunnel's own and is identical for every caller. Rate
// limiting on it would put the entire internet in a single bucket — one abuser
// would lock everyone out. Cloudflare passes the real client address along in
// CF-Connecting-IP, which is trustworthy here because the container is not
// reachable except through the tunnel.
export function resolveClientIp(req: Record<string, any>): string {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;

    const cloudflareIp = headers['cf-connecting-ip'];
    if (typeof cloudflareIp === 'string' && cloudflareIp.length > 0) {
        return cloudflareIp;
    }

    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }

    return typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : 'unknown';
}
