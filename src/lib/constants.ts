import {
  Map,
  List,
  FileText,
  MessageSquare,
  ClipboardList,
  DoorOpen,
  Calendar,
  User,
  Wrench,
  LayoutDashboard,
  Users,
  Building2,
  Settings,
} from 'lucide-react';

// ─── Tab configurations per role ────────────────────

export const motebookerTabs = [
  { id: 'kart', label: 'Kart', href: '/motebooker/kart', icon: Map },
  { id: 'oversikt', label: 'Oversikt', href: '/motebooker/oversikt', icon: List },
  { id: 'maler', label: 'Maler', href: '/motebooker/maler', icon: FileText },
  { id: 'chat', label: 'Chat', href: '/motebooker/chat', icon: MessageSquare },
];

export const feltselgerTabs = [
  { id: 'besok', label: 'Mine besøk', href: '/feltselger/besok', icon: ClipboardList },
  { id: 'dor-til-dor', label: 'Dør-til-dør', href: '/feltselger/dor-til-dor', icon: DoorOpen },
  { id: 'kalender', label: 'Kalender', href: '/feltselger/kalender', icon: Calendar },
  { id: 'chat', label: 'Chat', href: '/feltselger/chat', icon: MessageSquare },
  { id: 'profil', label: 'Profil', href: '/feltselger/profil', icon: User },
];

export const teknikerTabs = [
  { id: 'oppdrag', label: 'Mine oppdrag', href: '/tekniker/oppdrag', icon: Wrench },
  { id: 'kalender', label: 'Kalender', href: '/tekniker/kalender', icon: Calendar },
  { id: 'chat', label: 'Chat', href: '/tekniker/chat', icon: MessageSquare },
  { id: 'profil', label: 'Profil', href: '/tekniker/profil', icon: User },
];

export const adminTabs = [
  { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'ansatte', label: 'Ansatte', href: '/admin/ansatte', icon: Users },
  { id: 'adresser', label: 'Adresser', href: '/admin/adresser', icon: Building2 },
  { id: 'innstillinger', label: 'Innstillinger', href: '/admin/innstillinger', icon: Settings },
];

// ─── Default checklist for technician ───────────────

export const defaultChecklist = [
  { id: 1, label: 'Sjekk avtrekksventiler', checked: false },
  { id: 2, label: 'Sjekk tilluftventiler', checked: false },
  { id: 3, label: 'Ren kanaler', checked: false },
  { id: 4, label: 'Sjekk vifteenhet', checked: false },
  { id: 5, label: 'Bytt filter', checked: false },
  { id: 6, label: 'Sjekk lyd/vibrasjon', checked: false },
  { id: 7, label: 'Sjekk kondens/fukt', checked: false },
  { id: 8, label: 'Sjekk brannstopp', checked: false },
  { id: 9, label: 'Måling før/etter', checked: false },
  { id: 10, label: 'Dokumentasjon og bilder', checked: false },
];

// ─── Product prices ─────────────────────────────────

export const defaultProducts = [
  { name: 'Ventilasjonsrens Standard', price: 3990 },
  { name: 'Ventilasjonsrens Stor', price: 4990 },
  { name: 'Ventilasjonsrens Premium', price: 5990 },
  { name: 'Service Standard', price: 1990 },
  { name: 'Service Pluss', price: 2990 },
  { name: 'Filterbytte', price: 990 },
];

export const productsByOrderType: Record<string, { name: string; label: string; price: number }[]> = {
  ventilasjonsrens: [
    { name: 'Standard', label: 'Standard', price: 3990 },
    { name: 'Medium', label: 'Medium', price: 4990 },
    { name: 'Stor', label: 'Stor', price: 5990 },
  ],
  service: [
    { name: 'Ny reim', label: 'Ny reim', price: 800 },
    { name: 'Filterbytte', label: 'Filterbytte', price: 990 },
    { name: 'Service Standard', label: 'Service Standard', price: 1990 },
    { name: 'Service Pluss', label: 'Service Pluss', price: 2990 },
  ],
};

export const paymentPlanOptions = [1, 2, 3, 6];

// ─── Filter subscription prices ─────────────────────

export const filterSubscriptionPrices = {
  6: 149,
  12: 129,
};

// ─── Office location (default: Oslo sentrum) ────────

export const DEFAULT_OFFICE_LOCATION = {
  lat: 59.9139,
  lon: 10.7522,
  address: 'Oslo sentrum',
};

// ─── Default settings keys ──────────────────────────

export const SETTING_KEYS = {
  OFFICE_STREET: 'office_street',
  OFFICE_POSTAL_CODE: 'office_postal_code',
  OFFICE_CITY: 'office_city',
  OFFICE_LAT: 'office_lat',
  OFFICE_LON: 'office_lon',
  COMPANY_NAME: 'company_name',
  COMPANY_ORG_NUMBER: 'company_org_number',
  COMPANY_PHONE: 'company_phone',
  COMPANY_EMAIL: 'company_email',
  CLEANING_INTERVAL_YEARS: 'cleaning_interval_years',
};
