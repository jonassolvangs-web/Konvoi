import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SETTING_KEYS } from '@/lib/constants';
import { geocodeAddress } from '@/lib/geonorge';

export async function GET() {
  try {
    await requireRole('ADMIN');

    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({ settings: settingsMap });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole('ADMIN');

    const { settings } = await req.json();

    for (const [key, value] of Object.entries(settings as Record<string, string>)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    // Skip geocoding if lat/lon already provided (from autocomplete)
    const hasCoordinates = settings[SETTING_KEYS.OFFICE_LAT] && settings[SETTING_KEYS.OFFICE_LON];
    let geocoded: { lat: number; lon: number } | null = null;

    if (hasCoordinates) {
      geocoded = {
        lat: parseFloat(settings[SETTING_KEYS.OFFICE_LAT]),
        lon: parseFloat(settings[SETTING_KEYS.OFFICE_LON]),
      };
    } else {
      // Fallback: geocode server-side if lat/lon missing
      const street = settings[SETTING_KEYS.OFFICE_STREET];
      const postalCode = settings[SETTING_KEYS.OFFICE_POSTAL_CODE];
      const city = settings[SETTING_KEYS.OFFICE_CITY];

      if (street && postalCode && city) {
        const result = await geocodeAddress(street, postalCode, city);
        if (result) {
          geocoded = { lat: result.lat, lon: result.lon };
          await prisma.setting.upsert({
            where: { key: SETTING_KEYS.OFFICE_LAT },
            update: { value: String(result.lat) },
            create: { key: SETTING_KEYS.OFFICE_LAT, value: String(result.lat) },
          });
          await prisma.setting.upsert({
            where: { key: SETTING_KEYS.OFFICE_LON },
            update: { value: String(result.lon) },
            create: { key: SETTING_KEYS.OFFICE_LON, value: String(result.lon) },
          });
        }
      }
    }

    return NextResponse.json({ success: true, geocoded });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
