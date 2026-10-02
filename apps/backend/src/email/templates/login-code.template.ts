// The page behind the email's button. It hands the code to the app when the
// app is there, and otherwise shows it with a button to copy it - an email
// cannot copy anything itself, since mail apps strip scripts.
const LOGIN_LINK_BASE = 'https://llogarite.site/hyr/';

// The code and address ride in the fragment, which browsers never send to a
// server, so neither lands in request logs along the way.
function loginLink(code: string, email: string): string {
    return `${LOGIN_LINK_BASE}#k=${code}&e=${encodeURIComponent(email)}`;
}

export function loginCodeEmailHtml(code: string, minutes: number, email: string): string {
    return `<!doctype html>
<html lang="sq">
  <body style="margin:0;padding:0;background-color:#EEF2FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF2FC;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:420px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(34,49,79,0.08);">
            <tr>
              <td style="background-color:#5B7FDB;padding:28px 32px;text-align:center;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Llogarite</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;color:#22314F;font-size:18px;font-weight:700;">Kodi yt i kyçjes</p>
                <p style="margin:0 0 24px;color:#7A8BB8;font-size:14px;line-height:20px;">
                  Shkruaje këtë kod në aplikacion për t'u kyçur, ose prek butonin më poshtë. Kodi skadon pas ${minutes} minutash.
                </p>
                <div style="background-color:#EEF2FC;border-radius:14px;padding:20px;text-align:center;margin-bottom:12px;">
                  <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#5B7FDB;">${code}</span>
                </div>
                <a href="${loginLink(code, email)}" style="display:block;background-color:#5B7FDB;border-radius:14px;padding:15px 20px;text-align:center;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:24px;">
                  Hap në aplikacion
                </a>
                <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;line-height:18px;">
                  Nëse nuk e kërkove këtë kod, injoroje këtë email — askush nuk mund të kyçet pa të.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;color:#9ca3af;font-size:11px;">Llogarite</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
