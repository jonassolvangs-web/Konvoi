export const metadata = {
  title: 'Personvern – Godt Vedlikehold',
};

export default function PersonvernPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1A1A2E', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Personvernerkl&aelig;ring</h1>
      <p style={{ color: '#6B6B7B', marginBottom: 32 }}>Sist oppdatert: 20. april 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Hvem vi er</h2>
      <p>Godt Vedlikehold (org.nr. 933 662 818) tilbyr ventilasjonsrens og relaterte tjenester. Vi er behandlingsansvarlig for personopplysninger vi samler inn.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Hvilke opplysninger vi samler inn</h2>
      <ul>
        <li>Navn, telefonnummer og e-postadresse</li>
        <li>Adresse og postnummer</li>
        <li>Informasjon du oppgir via bookingskjema eller Facebook Lead Ads</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Hvorfor vi samler inn opplysninger</h2>
      <ul>
        <li>For &aring; levere tjenesten du har bestilt</li>
        <li>For &aring; kontakte deg om avtalt tid</li>
        <li>For &aring; sende bekreftelse p&aring; e-post eller SMS</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Rettslig grunnlag</h2>
      <p>Behandlingen er basert p&aring; avtale (GDPR art. 6 nr. 1 bokstav b) &ndash; vi trenger opplysningene for &aring; oppfylle tjenesten du har bestilt.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Deling av opplysninger</h2>
      <p>Vi deler ikke personopplysninger med tredjeparter, med unntak av tekniske underleverand&oslash;rer som er n&oslash;dvendige for &aring; levere tjenesten (e-post, SMS).</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Lagring og sletting</h2>
      <p>Opplysninger lagres s&aring; lenge det er n&oslash;dvendig for &aring; oppfylle form&aring;let, og slettes n&aring;r de ikke lenger er relevante.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Dine rettigheter</h2>
      <p>Du har rett til innsyn, retting og sletting av dine opplysninger. Kontakt oss p&aring; <a href="mailto:hei@godtvedlikehold.no" style={{ color: '#1B3C73' }}>hei@godtvedlikehold.no</a> for henvendelser.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Kontakt</h2>
      <p>Godt Vedlikehold<br />E-post: <a href="mailto:hei@godtvedlikehold.no" style={{ color: '#1B3C73' }}>hei@godtvedlikehold.no</a><br />Org.nr: 933 662 818</p>
    </main>
  );
}
