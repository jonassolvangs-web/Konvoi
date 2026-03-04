import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

// ─── Class names ────────────────────────────────────

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Date formatting ────────────────────────────────

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd.MM.yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd.MM.yyyy HH:mm');
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm');
}

export function formatDateLong(date: string | Date): string {
  return format(new Date(date), 'd. MMMM yyyy', { locale: nb });
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'd. MMM', { locale: nb });
}

export function formatDayName(date: string | Date): string {
  return format(new Date(date), 'EEEE', { locale: nb });
}

// ─── Currency formatting ────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Phone formatting ───────────────────────────────

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('47')) {
    return `+47 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

// ─── Initials ───────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Haversine distance ─────────────────────────────

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDriveDistance(straightLineKm: number): number {
  return Math.round(straightLineKm * 1.4 * 10) / 10;
}

export function calculateDriveTime(driveDistanceKm: number): number {
  return Math.round((driveDistanceKm / 40) * 60);
}

export function formatDistance(km: number, min: number): string {
  return `${km} km \u00b7 ${min} min`;
}

// ─── Status configs ─────────────────────────────────

export const orgStatusConfig: Record<string, { label: string; color: string }> = {
  ikke_tildelt: { label: 'Ikke tildelt', color: 'bg-gray-100 text-gray-700' },
  tildelt: { label: 'Tildelt', color: 'bg-blue-100 text-blue-700' },
  mote_booket: { label: 'Møte booket', color: 'bg-purple-100 text-purple-700' },
  besok_pagaar: { label: 'Besøk pågår', color: 'bg-yellow-100 text-yellow-700' },
  venter_tekniker: { label: 'Venter tekniker', color: 'bg-orange-100 text-orange-700' },
  rens_pagaar: { label: 'Rens pågår', color: 'bg-cyan-100 text-cyan-700' },
  fullfort: { label: 'Fullført', color: 'bg-green-100 text-green-700' },
  kansellert: { label: 'Kansellert', color: 'bg-red-100 text-red-600' },
};

export const appointmentStatusConfig: Record<string, { label: string; color: string }> = {
  planlagt: { label: 'Planlagt', color: 'bg-blue-100 text-blue-700' },
  pagaar: { label: 'Pågår', color: 'bg-yellow-100 text-yellow-700' },
  fullfort: { label: 'Fullført', color: 'bg-green-100 text-green-700' },
  kansellert: { label: 'Kansellert', color: 'bg-red-100 text-red-600' },
};

export const visitStatusConfig: Record<string, { label: string; color: string }> = {
  planlagt: { label: 'Planlagt', color: 'bg-blue-100 text-blue-700' },
  pagaar: { label: 'Pågår', color: 'bg-yellow-100 text-yellow-700' },
  fullfort: { label: 'Fullført', color: 'bg-green-100 text-green-700' },
};

export const dwellingVisitStatusConfig: Record<string, { label: string; color: string }> = {
  ikke_besokt: { label: 'Ikke besøkt', color: 'bg-gray-100 text-gray-700' },
  besok_booket: { label: 'Booket', color: 'bg-green-100 text-green-700' },
  solgt: { label: 'Solgt', color: 'bg-green-100 text-green-700' },
  ikke_interessert: { label: 'Ikke interessert', color: 'bg-red-100 text-red-600' },
  ikke_hjemme: { label: 'Ikke hjemme', color: 'bg-yellow-100 text-yellow-700' },
};

export const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  ikke_betalt: { label: 'Ikke betalt', color: 'bg-gray-100 text-gray-700' },
  vipps_sendt: { label: 'Vipps sendt', color: 'bg-orange-100 text-orange-700' },
  faktura_sendt: { label: 'Faktura sendt', color: 'bg-blue-100 text-blue-700' },
  plan_aktiv: { label: 'Plan aktiv', color: 'bg-purple-100 text-purple-700' },
  betalt: { label: 'Betalt', color: 'bg-green-100 text-green-700' },
  forfalt: { label: 'Forfalt', color: 'bg-red-100 text-red-600' },
};

export const workOrderStatusConfig: Record<string, { label: string; color: string }> = {
  planlagt: { label: 'Planlagt', color: 'bg-blue-100 text-blue-700' },
  pagaar: { label: 'Pågår', color: 'bg-yellow-100 text-yellow-700' },
  fullfort: { label: 'Fullført', color: 'bg-green-100 text-green-700' },
};

export const callResultConfig: Record<string, { label: string; color: string }> = {
  mote_booket: { label: 'Møte booket', color: 'bg-green-100 text-green-700' },
  ikke_svar: { label: 'Ikke svar', color: 'bg-gray-100 text-gray-700' },
  ring_tilbake: { label: 'Ring tilbake', color: 'bg-yellow-100 text-yellow-700' },
  nei: { label: 'Nei', color: 'bg-red-100 text-red-600' },
};

export const reminderStatusConfig: Record<string, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'bg-green-100 text-green-700' },
  innen_6mnd: { label: 'Innen 6 mnd', color: 'bg-yellow-100 text-yellow-700' },
  innen_3mnd: { label: 'Innen 3 mnd', color: 'bg-orange-100 text-orange-700' },
  forfalt: { label: 'Forfalt', color: 'bg-red-100 text-red-600' },
};

// ─── Role helpers ───────────────────────────────────

export const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  MOTEBOOKER: 'Møtebooker',
  FELTSELGER: 'Feltselger',
  TEKNIKER: 'Tekniker',
};

export function getRoleLabel(role: string): string {
  return roleLabels[role] || role;
}
