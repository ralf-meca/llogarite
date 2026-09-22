export function loginCodeEmailHtml(code: string, minutes: number): string {
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
                  Shkruaje këtë kod në aplikacion për t'u kyçur. Kodi skadon pas ${minutes} minutash.
                </p>
                <div style="background-color:#EEF2FC;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px;">
                  <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#5B7FDB;">${code}</span>
                </div>
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
