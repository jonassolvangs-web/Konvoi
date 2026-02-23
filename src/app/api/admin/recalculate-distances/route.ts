import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SETTING_KEYS } from '@/lib/constants';
import { haversine, calculateDriveDistance, calculateDriveTime } from '@/lib/utils';

export async function POST() {
  try {
    await requireRole('ADMIN');

    const latSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.OFFICE_LAT } });
    const lonSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.OFFICE_LON } });

    if (!latSetting || !lonSetting) {
      return NextResponse.json({ error: 'Kontoradresse er ikke satt' }, { status: 400 });
    }

    const officeLat = parseFloat(latSetting.value);
    const officeLon = parseFloat(lonSetting.value);

    if (isNaN(officeLat) || isNaN(officeLon)) {
      return NextResponse.json({ error: 'Ugyldige koordinater for kontoret' }, { status: 400 });
    }

    const organizations = await prisma.organization.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    let updatedCount = 0;

    for (const org of organizations) {
      const straightKm = haversine(officeLat, officeLon, org.latitude!, org.longitude!);
      const driveKm = calculateDriveDistance(straightKm);
      const driveMin = calculateDriveTime(driveKm);

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          distanceFromOfficeKm: driveKm,
          distanceFromOfficeMin: driveMin,
        },
      });

      updatedCount++;
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    if (error.message === 'Ingen tilgang') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    console.error('Recalculate distances error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
