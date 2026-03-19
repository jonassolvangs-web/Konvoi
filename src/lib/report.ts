interface ReportUnit {
  dwellingUnit: {
    unitNumber: string;
    residentName: string | null;
    residentPhone: string | null;
    residentEmail: string | null;
  };
  productName: string | null;
  price: number;
  paymentPlanMonths: number | null;
  paymentMethod: string | null;
  checklist: any;
  airBefore: number | null;
  airAfter: number | null;
  photoBeforeUrl: string | null;
  photoAfterUrl: string | null;
}

interface ReportData {
  organizationName: string;
  organizationAddress: string;
  technicianName: string;
  technicianPhone: string;
  technicianEmail: string;
  completedDate: string;
  units: ReportUnit[];
}

interface GreetingData {
  residentName: string | null;
  organizationName: string;
  completedDate: string;
}

export function generateGreetingHtml(data: GreetingData): string {
  return `
    <!DOCTYPE html>
    <html lang="no">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
      <p>Hei,</p>
      <p>Takk for at du valgte Godt Vedlikehold! Her er rapporten fra ventilasjonsrensen som ble gjennomf&oslash;rt ${data.completedDate}.</p>
      <p>Med vennlig hilsen,<br>Godt Vedlikehold</p>
    </body>
    </html>
  `;
}

export function generateReportHtml(data: ReportData, baseUrl: string): string {
  const darkBlue = '#1e2a3a';
  const lightGray = '#f5f5f5';

  const unitsHtml = data.units.map((unit) => {
    const customerName = unit.dwellingUnit.residentName || data.organizationName;
    const customerPhone = unit.dwellingUnit.residentPhone || '';
    const customerEmail = unit.dwellingUnit.residentEmail || '';

    // Utført arbeid - fast liste
    const workItems = [
      'Rengjøring av tilluftskanaler',
      'Rengjøring av avtrekkskanaler',
      'Rens av ventiler og ventilrister',
      'Kontroll av aggregat og vifter',
    ];

    const workHtml = workItems.map((item) => `
      <li style="margin-bottom: 6px; color: #333;">${item}</li>
    `).join('');

    // Luftmålinger
    const airHtml = (unit.airBefore != null || unit.airAfter != null) ? `
      <div style="margin: 24px 0;">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 12px;">Luftm&aring;linger</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            ${unit.airBefore != null ? `<td style="padding: 10px 16px; background: ${lightGray}; border-radius: 6px; width: 50%;"><span style="color: #666; font-size: 12px;">F&oslash;r:</span><br><strong style="font-size: 18px;">${unit.airBefore} l/s</strong></td>` : ''}
            ${unit.airAfter != null ? `<td style="padding: 10px 16px; background: ${lightGray}; border-radius: 6px; width: 50%;"><span style="color: #666; font-size: 12px;">Etter:</span><br><strong style="font-size: 18px;">${unit.airAfter} l/s</strong>${unit.airBefore != null && unit.airAfter > unit.airBefore ? ` <span style="color: #16a34a; font-size: 13px; font-weight: bold;">(+${Math.round(((unit.airAfter - unit.airBefore) / unit.airBefore) * 100)}%)</span>` : ''}</td>` : ''}
          </tr>
        </table>
      </div>
    ` : '';

    // Bilder
    const photosHtml = (unit.photoBeforeUrl || unit.photoAfterUrl) ? `
      <div style="margin: 24px 0;">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 12px;">Dokumentasjon &mdash; f&oslash;r og etter</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 8px;">
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 0 0 6px;">F&oslash;r rens</p>
              ${unit.photoBeforeUrl ? `<img src="${baseUrl}${unit.photoBeforeUrl}" alt="Før rens" style="width: 100%; border-radius: 6px; border: 1px solid #e0e0e0;" />` : '<div style="height: 160px; background: #f0f0f0; border-radius: 6px; border: 1px solid #e0e0e0;"></div>'}
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 8px;">
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 0 0 6px;">Etter rens</p>
              ${unit.photoAfterUrl ? `<img src="${baseUrl}${unit.photoAfterUrl}" alt="Etter rens" style="width: 100%; border-radius: 6px; border: 1px solid #e0e0e0;" />` : '<div style="height: 160px; background: #f0f0f0; border-radius: 6px; border: 1px solid #e0e0e0;"></div>'}
            </td>
          </tr>
        </table>
      </div>
    ` : '';

    return `
      <!-- Kundeinformasjon + Referanse -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 55%; vertical-align: top; padding-right: 16px;">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 10px;">Kundeinformasjon</h3>
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px;">
              <p style="margin: 0 0 4px; font-size: 14px;"><span style="color: #666;">Navn:</span> <strong>${customerName}</strong></p>
              <p style="margin: 0 0 4px; font-size: 14px;"><span style="color: #666;">Adresse:</span> ${data.organizationAddress}</p>
              ${customerPhone ? `<p style="margin: 0 0 4px; font-size: 14px;"><span style="color: #666;">Tlf:</span> ${customerPhone}</p>` : ''}
              ${customerEmail ? `<p style="margin: 0; font-size: 14px;"><span style="color: #666;">E-post:</span> ${customerEmail}</p>` : ''}
            </div>
          </td>
          <td style="width: 45%; vertical-align: top;">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 10px;">Referanse</h3>
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #666; font-size: 14px; padding: 2px 0;">Dato:</td><td style="text-align: right; font-weight: 700; font-size: 14px;">${data.completedDate}</td></tr>
                <tr><td style="color: #666; font-size: 14px; padding: 2px 0;">Deres ref:</td><td style="text-align: right; font-weight: 700; font-size: 14px;">${data.technicianName}</td></tr>
                ${data.technicianPhone ? `<tr><td style="color: #666; font-size: 14px; padding: 2px 0;">Tlf:</td><td style="text-align: right; font-weight: 700; font-size: 14px;">${data.technicianPhone}</td></tr>` : ''}
                ${data.technicianEmail ? `<tr><td style="color: #666; font-size: 14px; padding: 2px 0;">E-post:</td><td style="text-align: right; font-weight: 700; font-size: 14px;">${data.technicianEmail}</td></tr>` : ''}
              </table>
            </div>
          </td>
        </tr>
      </table>

      <!-- Utført arbeid -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 10px;">Utf&oslash;rt arbeid</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          ${workHtml}
        </ul>
      </div>

      ${airHtml}
      ${photosHtml}
    `;
  }).join('<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;" />');

  return `
    <!DOCTYPE html>
    <html lang="no">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 0; color: #111; background: #ffffff;">

      <!-- Header -->
      <div style="padding: 24px 32px;">
        <h2 style="margin: 0; font-size: 20px; color: ${darkBlue};">Godt Vedlikehold</h2>
        <p style="margin: 2px 0 0; font-size: 12px; color: #888; font-style: italic;">Bedre inneklima, renere luft</p>
      </div>

      <!-- Title banner -->
      <div style="background: ${darkBlue}; padding: 18px 32px; margin-bottom: 28px;">
        <h1 style="margin: 0; font-size: 22px; color: white; font-weight: 600;">Ventilasjonsrens rapport</h1>
      </div>

      <!-- Content -->
      <div style="padding: 0 32px 32px;">
        ${unitsHtml}
      </div>

      <!-- Footer -->
      <div style="padding: 16px 32px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 11px;">
        <p style="margin: 0;">Godt Vedlikehold &mdash; Bedre inneklima, renere luft</p>
      </div>
    </body>
    </html>
  `;
}
