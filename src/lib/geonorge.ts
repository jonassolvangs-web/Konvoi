const GEONORGE_API = 'https://ws.geonorge.no/adresser/v1/sok';

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
  const params = new URLSearchParams({
    sok: query,
    treffPerSide: String(limit),
    utkoordsys: '4258',
  });

  const res = await fetch(`${GEONORGE_API}?${params}`);
  if (!res.ok) return [];

  const data: GeonorgeResponse = await res.json();
  return data.adresser.map((a) => ({
    address: a.adressetekst,
    postalCode: a.postnummer,
    city: a.poststed,
    lat: a.representasjonspunkt.lat,
    lon: a.representasjonspunkt.lon,
  }));
}

export async function geocodeAddress(
  street: string,
  postalCode?: string,
  city?: string
): Promise<AddressResult | null> {
  const parts = [street, postalCode, city].filter(Boolean).join(' ');
  const results = await searchAddresses(parts, 1);
  return results[0] || null;
}
