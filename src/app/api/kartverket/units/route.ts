import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

interface KartverketAddress {
  bruksenhetsnummer?: string[];
  representasjonspunkt?: { lat: number; lon: number };
  adressetekst?: string;
}

interface KartverketResponse {
  adresser?: KartverketAddress[];
}

/**
 * Parse bruksenhetsnummer: e.g. "H0301" → floor 3, unit 01
 * H = Hovedetasje, U = Underetasje, K = Kjeller, L = Loft
 */
function parseBruksenhet(bn: string): { unitNumber: string; floor: number | null } {
  const match = bn.match(/^([HUKL])(\d{2})(\d{2})$/);
  if (!match) {
    return { unitNumber: bn, floor: null };
  }

  const [, prefix, floorStr, unitStr] = match;
  let floor = parseInt(floorStr, 10);

  // Adjust floor based on prefix
  if (prefix === 'K') floor = -floor;
  if (prefix === 'U') floor = -floor;
  if (prefix === 'L') floor = floor + 100; // mark as loft

  return {
    unitNumber: bn,
    floor: floor === 0 ? null : floor,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const postalCode = searchParams.get('postalCode');

    if (!address) {
      return NextResponse.json({ error: 'address kreves' }, { status: 400 });
    }

    // Build search query for Kartverket/Geonorge
    const params = new URLSearchParams({
      sok: address,
      treffPerSide: '50',
      utkoordsys: '4258',
    });
    if (postalCode) {
      params.set('postnummer', postalCode);
    }

    const geoRes = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?${params.toString()}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!geoRes.ok) {
      return NextResponse.json({ error: 'Kartverket API feil', units: [] }, { status: 502 });
    }

    const data: KartverketResponse = await geoRes.json();

    if (!data.adresser || data.adresser.length === 0) {
      return NextResponse.json({ units: [] });
    }

    // Collect all unique bruksenhetsnummer across matching addresses
    const unitSet = new Set<string>();
    const units: { unitNumber: string; floor: number | null }[] = [];

    for (const addr of data.adresser) {
      if (addr.bruksenhetsnummer) {
        for (const bn of addr.bruksenhetsnummer) {
          if (!unitSet.has(bn)) {
            unitSet.add(bn);
            units.push(parseBruksenhet(bn));
          }
        }
      }
    }

    // Sort by floor then unitNumber
    units.sort((a, b) => {
      const fa = a.floor ?? 0;
      const fb = b.floor ?? 0;
      if (fa !== fb) return fa - fb;
      return a.unitNumber.localeCompare(b.unitNumber);
    });

    return NextResponse.json({ units });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Kartverket API error:', error);
    return NextResponse.json({ error: 'Intern feil', units: [] }, { status: 500 });
  }
}
