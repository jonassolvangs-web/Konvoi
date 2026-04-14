const GEONORGE_API = 'https://ws.geonorge.no/adresser/v1/sok';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

interface GeonorgeAddress {
  adressetekst: string;
  postnummer: string;
  poststed: string;
  representasjonspunkt: { lat: number; lon: number };
}

interface GeonorgeResponse {
  adresser: GeonorgeAddress[];
}

export interface AddressResult {
  address: string;
  postalCode: string;
  city: string;
  lat: number;
  lon: number;
}

export async function searchAddresses(query: string, limit = 5): Promise<AddressResult[]> {
  try {
    const params = new URLSearchParams({
      sok: query,
      treffPerSide: String(limit),
      utkoordsys: '4258',
    });

    const res = await fetch(`${GEONORGE_API}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data: GeonorgeResponse = await res.json();
    return data.adresser.map((a) => ({
      address: a.adressetekst,
      postalCode: a.postnummer,
      city: a.poststed,
      lat: a.representasjonspunkt.lat,
      lon: a.representasjonspunkt.lon,
    }));
  } catch (err) {
    console.error('Geonorge search failed:', err);
    return [];
  }
}

/** Fallback geocoding via OpenStreetMap Nominatim */
async function geocodeNominatim(query: string): Promise<AddressResult | null> {
  try {
    const params = new URLSearchParams({
      q: query + ', Norge',
      format: 'json',
      limit: '1',
      countrycodes: 'no',
    });

    const res = await fetch(`${NOMINATIM_API}?${params}`, {
      headers: { 'User-Agent': 'Turbo-CRM/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data[0]) return null;

    return {
      address: data[0].display_name?.split(',')[0] || query,
      postalCode: '',
      city: '',
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.error('Nominatim geocoding failed:', err);
    return null;
  }
}

export async function geocodeAddress(
  street: string,
  postalCode?: string,
  city?: string
): Promise<AddressResult | null> {
  // Try Geonorge with full address
  const fullQuery = [street, postalCode, city].filter(Boolean).join(' ');
  const results = await searchAddresses(fullQuery, 1);
  if (results[0]) return results[0];

  // Retry Geonorge with just street name
  if (postalCode || city) {
    const streetOnly = await searchAddresses(street, 1);
    if (streetOnly[0]) return streetOnly[0];
  }

  // Fallback to Nominatim (OpenStreetMap)
  console.warn('Geonorge failed, trying Nominatim for:', fullQuery);
  const nominatimResult = await geocodeNominatim(fullQuery);
  if (nominatimResult) return nominatimResult;

  console.warn('All geocoding failed for:', fullQuery);
  return null;
}
