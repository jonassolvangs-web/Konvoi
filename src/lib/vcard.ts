/**
 * Generate a vCard string and trigger download/save to contacts.
 * On mobile, opening a .vcf file prompts the OS to add the contact.
 */
export function saveContact(contact: {
  name: string;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  address?: string | null;
}) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.name}`,
    `N:${contact.name.split(' ').reverse().join(';')};;;`,
  ];

  if (contact.phone) {
    lines.push(`TEL;TYPE=CELL:${contact.phone}`);
  }
  if (contact.email) {
    lines.push(`EMAIL:${contact.email}`);
  }
  if (contact.organization) {
    lines.push(`ORG:${contact.organization}`);
  }
  if (contact.address) {
    lines.push(`ADR;TYPE=WORK:;;${contact.address};;;;`);
    lines.push(`NOTE:${contact.organization || ''} - ${contact.address}`);
  }

  lines.push('END:VCARD');

  const vcf = lines.join('\r\n');
  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${contact.name.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
