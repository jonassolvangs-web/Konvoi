interface ReportUnit {
  dwellingUnit: {
    unitNumber: string;
    residentName: string | null;
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
  completedDate: string;
  units: ReportUnit[];
}

function parseChecklist(raw: any): { id: number; label: string; checked: boolean }[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', minimumFractionDigits: 0 }).format(amount);
}

export function generateReportHtml(data: ReportData, baseUrl: string): string {
  const nextCleaning = new Date();
  nextCleaning.setFullYear(nextCleaning.getFullYear() + 3);
  const nextCleaningStr = nextCleaning.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long' });

  const unitsHtml = data.units.map((unit) => {
    const checklist = parseChecklist(unit.checklist);
    const checklistHtml = checklist.map((item) => `
      <tr>
        <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">
          ${item.checked ? '&#9989;' : '&#10060;'} ${item.label}
        </td>
      </tr>
    `).join('');

    const airHtml = unit.airBefore != null && unit.airAfter != null ? `
      <div style="margin: 12px 0; padding: 12px; background: #f0f9ff; border-radius: 8px;">
        <strong>Luftmålinger:</strong><br>
        F&oslash;r: ${unit.airBefore} l/s &rarr; Etter: ${unit.airAfter} l/s
        ${unit.airAfter > unit.airBefore ? ` <span style="color: #16a34a; font-weight: bold;">(+${Math.round(((unit.airAfter - unit.airBefore) / unit.airBefore) * 100)}%)</span>` : ''}
      </div>
    ` : '';

    const photosHtml = (unit.photoBeforeUrl || unit.photoAfterUrl) ? `
      <div style="margin: 12px 0; display: flex; gap: 12px;">
        ${unit.photoBeforeUrl ? `
          <div style="flex: 1;">
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">F&oslash;r:</p>
            <img src="${baseUrl}${unit.photoBeforeUrl}" alt="Før" style="width: 100%; max-width: 300px; border-radius: 8px;" />
          </div>
        ` : ''}
        ${unit.photoAfterUrl ? `
          <div style="flex: 1;">
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Etter:</p>
            <img src="${baseUrl}${unit.photoAfterUrl}" alt="Etter" style="width: 100%; max-width: 300px; border-radius: 8px;" />
          </div>
        ` : ''}
      </div>
    ` : '';

    return `
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h3 style="margin: 0 0 8px; font-size: 16px;">
          Enhet ${unit.dwellingUnit.unitNumber}
          ${unit.dwellingUnit.residentName ? ` – ${unit.dwellingUnit.residentName}` : ''}
        </h3>
        <p style="margin: 0 0 12px; color: #666;">
          ${unit.productName || '–'} · ${formatCurrency(unit.price)}
          ${unit.paymentPlanMonths && unit.paymentPlanMonths > 0 ? ` · ${unit.paymentPlanMonths} mnd` : ''}
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <thead>
            <tr><th style="text-align: left; padding: 4px 8px; border-bottom: 2px solid #ddd; font-size: 13px; color: #666;">Sjekkliste</th></tr>
          </thead>
          <tbody>${checklistHtml}</tbody>
        </table>

        ${airHtml}
        ${photosHtml}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="no">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 22px; margin: 0;">Rapport – Ventilasjonsrens</h1>
        <p style="color: #666; margin: 4px 0;">${data.completedDate}</p>
      </div>

      <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 12px;">
        <p style="margin: 0;"><strong>Adresse:</strong> ${data.organizationAddress}</p>
        <p style="margin: 4px 0 0;"><strong>Sameie:</strong> ${data.organizationName}</p>
        <p style="margin: 4px 0 0;"><strong>Tekniker:</strong> ${data.technicianName}</p>
      </div>

      ${unitsHtml}

      <div style="margin-top: 24px; padding: 16px; background: #fffbeb; border-radius: 12px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>Anbefalt neste rens:</strong> ${nextCleaningStr}
        </p>
      </div>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #999; font-size: 12px;">
        <p>Denne rapporten er generert av Konvoi</p>
      </div>
    </body>
    </html>
  `;
}
