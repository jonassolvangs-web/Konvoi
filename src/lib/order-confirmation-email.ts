interface OrderConfirmationData {
  customerName: string;
  address: string;
  postalCode?: string;
  city?: string;
  product: string;
  price: number;
  scheduledAt: string; // ISO 8601
  customerEmail?: string;
}

export function generateOrderConfirmationHtml(data: OrderConfirmationData): string {
  const darkBlue = '#1e2a3a';
  const accentBlue = '#3B82F6';

  const schedDate = new Date(data.scheduledAt);
  const dateStr = schedDate.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = schedDate.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const fullAddress = [data.address, data.postalCode, data.city]
    .filter(Boolean)
    .join(', ');

  const priceFormatted = data.price.toLocaleString('nb-NO');

  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${darkBlue};padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Godt Vedlikehold</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <!-- Greeting -->
            <p style="margin:0 0 20px;font-size:16px;">Hei ${data.customerName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
              Takk for din bestilling! Her er en bekreftelse p&aring; det som er avtalt.
            </p>

            <!-- Order details box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:${darkBlue};">Din bestilling</h2>
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                    <tr>
                      <td style="padding:6px 0;color:#666;width:110px;">Tjeneste</td>
                      <td style="padding:6px 0;font-weight:600;">${data.product}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;">Pris</td>
                      <td style="padding:6px 0;font-weight:600;">${priceFormatted} kr inkl. mva</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;">Adresse</td>
                      <td style="padding:6px 0;font-weight:600;">${fullAddress}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;">Dato</td>
                      <td style="padding:6px 0;font-weight:600;">${dateStr}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;">Tidspunkt</td>
                      <td style="padding:6px 0;font-weight:600;">${timeStr}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- What's included -->
            <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:${darkBlue};">Dette inng&aring;r i tjenesten</h3>
            <ul style="margin:0 0 28px;padding-left:20px;font-size:14px;line-height:1.8;color:#333;">
              <li>Rensing av alle kanaler fra ventil til koblingspunkt</li>
              <li>Rensing og kontroll av ventiler</li>
              <li>Rapport med bilder (f&oslash;r og etter)</li>
            </ul>

            <!-- Angrerett box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 24px;">
                  <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;color:${accentBlue};">Angrerett</h3>
                  <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                    Du har 14 dagers angrerett i henhold til angrerettloven. Dersom du &oslash;nsker &aring; benytte deg av angreretten, ta kontakt med oss p&aring;
                    <a href="mailto:hei@godtvedlikehold.no" style="color:${accentBlue};">hei@godtvedlikehold.no</a>.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Forbehold -->
            <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:${darkBlue};">Forbehold</h3>
            <ul style="margin:0 0 28px;padding-left:20px;font-size:13px;line-height:1.8;color:#555;">
              <li>Kjøkkenventilator med kullfilter er ikke en del av ventilasjonsanlegget. Vi anbefaler filterbytte hvert &aring;r.</li>
              <li>Dersom det er forhold knyttet til sikring eller el-anlegg som hindrer utf&oslash;relse, forbeholder vi oss retten til &aring; avbryte oppdraget.</li>
              <li>Vi lagrer kontaktinformasjon for &aring; kunne sende rapport og eventuelt p&aring;minnelse om neste rens.</li>
            </ul>

            <!-- Signature -->
            <p style="margin:0;font-size:15px;">Med vennlig hilsen,</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;">Godt Vedlikehold</p>
            <p style="margin:4px 0 0;font-size:13px;color:#555;">
              <a href="mailto:hei@godtvedlikehold.no" style="color:${accentBlue};text-decoration:none;">hei@godtvedlikehold.no</a>
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Godt Vedlikehold AS &middot;
              <a href="https://www.godtvedlikehold.no" style="color:${accentBlue};text-decoration:none;">www.godtvedlikehold.no</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
