import prisma from '@/lib/prisma';
import { SETTING_KEYS } from '@/lib/constants';
import { DEFAULT_OFFICE_LOCATION } from '@/lib/constants';
import { haversine, calculateDriveDistance, calculateDriveTime } from '@/lib/utils';

export async function getOfficeCoordinates(): Promise<{ lat: number; lon: number }> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: [SETTING_KEYS.OFFICE_LAT, SETTING_KEYS.OFFICE_LON] } },
  });

  const latSetting = settings.find((s) => s.key === SETTING_KEYS.OFFICE_LAT);
  const lonSetting = settings.find((s) => s.key === SETTING_KEYS.OFFICE_LON);

  const lat = latSetting ? parseFloat(latSetting.value) : DEFAULT_OFFICE_LOCATION.lat;
  const lon = lonSetting ? parseFloat(lonSetting.value) : DEFAULT_OFFICE_LOCATION.lon;

  return { lat, lon };
}

export function calculateDistanceFromOffice(
  officeLat: number,
  officeLon: number,
  orgLat: number,
  orgLon: number
): { distanceFromOfficeKm: number; distanceFromOfficeMin: number } {
  const straightLine = haversine(officeLat, officeLon, orgLat, orgLon);
  const distanceFromOfficeKm = calculateDriveDistance(straightLine);
  const distanceFromOfficeMin = calculateDriveTime(distanceFromOfficeKm);
  return { distanceFromOfficeKm, distanceFromOfficeMin };
}
