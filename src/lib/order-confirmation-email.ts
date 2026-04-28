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
  const schedDate = new Date(data.scheduledAt);
  const dateStr = schedDate.toLocaleDateString('nb-NO', {
    timeZone: 'Europe/Oslo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = schedDate.toLocaleTimeString('nb-NO', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  });
  // Capitalize first letter of weekday
  const dateTimeStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' kl. ' + timeStr;

  const fullAddress = [data.address, data.postalCode, data.city]
    .filter(Boolean)
    .join(', ');

  const priceFormatted = 'kr ' + data.price.toLocaleString('nb-NO') + ',-';

  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0; color: #111; background: #f5f5f5;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden; margin: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #1e2a3a; padding: 24px 32px;">
      <h1 style="margin: 0; font-size: 20px; color: white; font-weight: 600;">Godt Vedlikehold</h1>
      <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; font-style: italic;">Bedre inneklima, renere luft</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">

      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">Hei ${data.customerName},</p>

      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Takk for din bestilling! Her er en bekreftelse p&aring; hva som er avtalt.
      </p>

      <!-- Order details -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e2a3a;">Bestilling</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 120px;">Produkt:</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600;">${data.product}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Pris:</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600;">${priceFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Adresse:</td>
            <td style="padding: 6px 0; font-size: 14px;">${fullAddress}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Dato:</td>
            <td style="padding: 6px 0; font-size: 14px;">${dateTimeStr}</td>
          </tr>
        </table>
      </div>

      <!-- What's included -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e2a3a;">Dette inng&aring;r</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 2; color: #334155;">
          <li>Rengj&oslash;ring av kanaler &ndash; kanalsystemet renses grundig fra ventil til koblingspunkt</li>
          <li>Rengj&oslash;ring av ventiler</li>
          <li>Rapport med f&oslash;r- og etterbilder</li>
        </ul>
      </div>

      <!-- Angrerett -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #0369a1; line-height: 1.6;">
          <strong>Angrerett:</strong> Du har 14 dagers angrerett i henhold til angrerettloven. Ta kontakt med oss dersom du &oslash;nsker &aring; benytte deg av denne.
        </p>
      </div>

      <!-- Forbehold -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e2a3a;">Forbehold</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #64748b;">
          <li style="margin-bottom: 8px;">Kj&oslash;kkenventilator og tilh&oslash;rende kanal inng&aring;r ikke i rensen. Fett fra kj&oslash;kkenventilatoren setter seg som en hinne i kanalen, men dette p&aring;virker ikke anleggets kapasitet. Rengj&oslash;ring av dette krever en egen spesialprosess. Den beste forebyggingen er &aring; rengj&oslash;re fettfiltrene i kj&oslash;kkenventilatoren jevnlig.</li>
          <li style="margin-bottom: 8px;">Ved arbeid p&aring; ventilasjonsanlegget skrus sikringen av. Godt Vedlikehold er ikke ansvarlig for skade p&aring; komponenter som skyldes gammelt eller defekt elektrisk anlegg.</li>
          <li>Vi lagrer kontaktinformasjonen din for oppf&oslash;lging av filteravtaler og anbefaling om fremtidig rens.</li>
        </ul>
      </div>

      <!-- Contact -->
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 8px;">
        Har du sp&oslash;rsm&aring;l? Ta gjerne kontakt med oss.
      </p>

      <br>
      <p style="margin: 0; font-size: 14px;">Med vennlig hilsen,</p>
      <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600;">Godt Vedlikehold</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">
        <a href="mailto:hei@godtvedlikehold.no" style="color: #3B82F6; text-decoration: none;">hei@godtvedlikehold.no</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">Godt Vedlikehold &mdash; Bedre inneklima, renere luft</p>
    </div>

  </div>
</body>
</html>`;
}
