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
  organizationPostalCode?: string;
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
  const greeting = data.residentName ? `Hei ${data.residentName},` : 'Hei,';
  return `
    <!DOCTYPE html>
    <html lang="no">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
      <p>${greeting}</p>
      <p>Takk for at du valgte Godt Vedlikehold! Vedlagt finner du rapporten fra ventilasjonsrensen som ble utf&oslash;rt ${data.completedDate}.</p>
      <br>
      <p style="margin: 0;">Med vennlig hilsen,</p>
      <p style="margin: 4px 0 0; font-weight: 600;">Godt Vedlikehold</p>
      <p style="margin: 2px 0 0; font-size: 13px; color: #555;">
        <a href="mailto:hei@godtvedlikehold.no" style="color: #3B82F6; text-decoration: none;">hei@godtvedlikehold.no</a>
      </p>
    </body>
    </html>
  `;
}

export function generateReportHtml(data: ReportData, baseUrl: string): string {
  const darkBlue = '#1e2a3a';

  const unitsHtml = data.units.map((unit) => {
    const customerName = unit.dwellingUnit.residentName || data.organizationName;
    const customerPhone = unit.dwellingUnit.residentPhone || '';
    const customerEmail = unit.dwellingUnit.residentEmail || '';

    // Format phone number with spaces (e.g. 47266383 -> 472 66 383)
    const formatPhone = (phone: string) => {
      const digits = phone.replace(/\D/g, '').replace(/^(\+47|0047)/, '');
      if (digits.length === 8) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
      }
      return phone;
    };

    // Utført arbeid
    const workItems = [
      'Rengj&oslash;ring av tilluftskanaler',
      'Rengj&oslash;ring av avtrekkskanaler',
      'Rengj&oslash;ring av ventiler',
    ];

    const workHtml = workItems.map((item) => `
      <li style="margin-bottom: 4px; color: #333;">${item}</li>
    `).join('');

    // Luftmålinger
    const airHtml = (unit.airBefore != null || unit.airAfter != null) ? `
      <div style="margin: 20px 0;">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 12px;">Luftm&aring;linger</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            ${unit.airBefore != null ? `<td style="padding: 10px 16px; background: #f5f5f5; border-radius: 6px; width: 50%;"><span style="color: #666; font-size: 12px;">F&oslash;r:</span><br><strong style="font-size: 18px;">${unit.airBefore} l/s</strong></td>` : ''}
            ${unit.airAfter != null ? `<td style="padding: 10px 16px; background: #f5f5f5; border-radius: 6px; width: 50%;"><span style="color: #666; font-size: 12px;">Etter:</span><br><strong style="font-size: 18px;">${unit.airAfter} l/s</strong>${unit.airBefore != null && unit.airAfter > unit.airBefore ? ` <span style="color: #16a34a; font-size: 13px; font-weight: bold;">(+${Math.round(((unit.airAfter - unit.airBefore) / unit.airBefore) * 100)}%)</span>` : ''}</td>` : ''}
          </tr>
        </table>
      </div>
    ` : '';

    // Bilder
    const photosHtml = (unit.photoBeforeUrl || unit.photoAfterUrl) ? `
      <div style="margin: 20px 0;">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 10px;">Dokumentasjon &mdash; f&oslash;r og etter</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 8px;">
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 0 0 6px;">F&oslash;r rens</p>
              ${unit.photoBeforeUrl ? `<img src="${unit.photoBeforeUrl.startsWith('data:') ? unit.photoBeforeUrl : baseUrl + unit.photoBeforeUrl}" alt="Før rens" style="width: 100%; height: 300px; object-fit: cover; border-radius: 6px; border: 1px solid #e0e0e0;" />` : '<div style="height: 160px; background: #f0f0f0; border-radius: 6px; border: 1px solid #e0e0e0;"></div>'}
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 8px;">
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 0 0 6px;">Etter rens</p>
              ${unit.photoAfterUrl ? `<img src="${unit.photoAfterUrl.startsWith('data:') ? unit.photoAfterUrl : baseUrl + unit.photoAfterUrl}" alt="Etter rens" style="width: 100%; height: 300px; object-fit: cover; border-radius: 6px; border: 1px solid #e0e0e0;" />` : '<div style="height: 160px; background: #f0f0f0; border-radius: 6px; border: 1px solid #e0e0e0;"></div>'}
            </td>
          </tr>
        </table>
      </div>
    ` : '';

    return `
      <!-- Kundeinformasjon + Referanse -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="width: 55%; vertical-align: top; padding-right: 16px;">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 10px;">Kundeinformasjon</h3>
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px;">
              <p style="margin: 0 0 4px; font-size: 14px;"><strong>Navn:</strong> ${customerName}</p>
              <p style="margin: 0 0 4px; font-size: 14px;"><strong>Adresse:</strong> ${data.organizationAddress}</p>
              <p style="margin: 0 0 4px; font-size: 14px;"><strong>Leilighetsnummer:</strong> ${unit.dwellingUnit.unitNumber}</p>
              ${data.organizationPostalCode ? `<p style="margin: 0 0 4px; font-size: 14px;"><strong>Postnr:</strong> ${data.organizationPostalCode}</p>` : ''}
              ${customerPhone ? `<p style="margin: 0 0 4px; font-size: 14px;"><strong>Tlf:</strong> ${formatPhone(customerPhone)}</p>` : ''}
              ${customerEmail ? `<p style="margin: 0; font-size: 14px;"><strong>E-post:</strong> ${customerEmail}</p>` : ''}
            </div>
          </td>
          <td style="width: 45%; vertical-align: top;">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${darkBlue}; margin: 0 0 10px;">Referanse</h3>
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px;">
              <p style="margin: 0 0 4px; font-size: 14px;"><strong>Dato:</strong> ${data.completedDate}</p>
              <p style="margin: 0 0 4px; font-size: 14px;"><strong>Deres ref:</strong> ${data.technicianName}</p>
              ${data.technicianPhone ? `<p style="margin: 0 0 4px; font-size: 14px;"><strong>Tlf:</strong> ${data.technicianPhone}</p>` : ''}
              ${data.technicianEmail ? `<p style="margin: 0; font-size: 14px;"><strong>E-post:</strong> ${data.technicianEmail}</p>` : ''}
            </div>
          </td>
        </tr>
      </table>

      <!-- Utført arbeid -->
      <div style="margin-bottom: 20px;">
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
    <head>
    <meta charset="UTF-8">
    <style>
      @page { size: A4; margin: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 0; color: #111; background: #ffffff; }
    </style>
    </head>
    <body>

      <!-- Header -->
      <div style="padding: 24px 32px 12px;">
        <h2 style="margin: 0; font-size: 20px; color: ${darkBlue};">Godt Vedlikehold</h2>
        <p style="margin: 2px 0 0; font-size: 12px; color: #888; font-style: italic;">Bedre inneklima, renere luft</p>
      </div>

      <!-- Title banner -->
      <div style="background: ${darkBlue}; padding: 18px 32px; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 22px; color: white; font-weight: 600;">Ventilasjonsrens rapport</h1>
      </div>

      <!-- Content -->
      <div style="padding: 0 32px 20px;">
        ${unitsHtml}
      </div>

      <!-- Footer -->
      <div style="padding: 14px 32px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 11px;">
        <p style="margin: 0;">Godt Vedlikehold &mdash; Bedre inneklima, renere luft</p>
      </div>

    </body>
    </html>
  `;
}
