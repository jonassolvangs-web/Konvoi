'use client';

import { useState, useCallback } from 'react';

const DAYS = ['S\u00f8n','Man','Tir','Ons','Tor','Fre','L\u00f8r'];
const MONTHS = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];

interface Slot { time: string; minutes: number }
type SlotsMap = Record<string, Slot[]>;

function getTimeLabel(minutes: number) {
  if (minutes < 720) return 'Formiddag';
  if (minutes < 1020) return 'Ettermiddag';
  return 'Kveld';
}

function formatDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return { dayName: DAYS[date.getDay()], dayNum: d, monthName: MONTHS[m - 1] };
}

export default function BestillPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postnr, setPostnr] = useState('');
  const [floor, setFloor] = useState('');

  const [slotsData, setSlotsData] = useState<SlotsMap>({});
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [selDateKey, setSelDateKey] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<Slot | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confData, setConfData] = useState({ name: '', address: '', date: '', time: '' });

  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  const fetchSlots = useCallback(async () => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() + 1);
    const to = new Date(today);
    to.setDate(today.getDate() + 21);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    try {
      const res = await fetch(`/api/public/booking/slots?from=${fromStr}&to=${toStr}&slotDuration=60`);
      if (!res.ok) throw new Error('Feil');
      const json = await res.json();
      const slots: SlotsMap = json.slots || {};
      const keys = Object.keys(slots).sort();
      setSlotsData(slots);
      setDateKeys(keys);
    } catch {
      setSlotsData({});
      setDateKeys([]);
    }
  }, []);

  async function goToStep2() {
    let hasError = false;
    if (!name.trim()) { setNameError(true); hasError = true; }
    if (!phone.trim()) { setPhoneError(true); hasError = true; }
    if (hasError) return;

    setLoading(true);
    await fetchSlots();
    setLoading(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function goToStep3() {
    if (submitting || !selDateKey || !selTime) return;
    setSubmitting(true);

    // Convert selected date/time (Oslo local) to proper ISO with timezone
    const localDate = new Date(`${selDateKey}T${selTime.time}:00`);
    const scheduledAt = localDate.toISOString();

    try {
      const res = await fetch('/api/public/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim(),
          postalCode: postnr.trim() || undefined,
          floor: floor || undefined,
          scheduledAt,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Kunne ikke opprette booking');

      const info = formatDateKey(selDateKey);
      setConfData({
        name: name.trim(),
        address: address.trim() || 'Ikke oppgitt',
        date: json.date || `${info.dayName} ${info.dayNum}. ${info.monthName}`,
        time: json.time || selTime.time,
      });
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Beklager, noe gikk galt: ' + err.message + '\n\nPr\u00f8v igjen eller ring oss p\u00e5 936 72 506.');
      setSubmitting(false);
    }
  }

  const currentSlots = selDateKey ? slotsData[selDateKey] || [] : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Caveat:wght@400;600;700&display=swap');
        .bestill-root *{margin:0;padding:0;box-sizing:border-box}
        .bestill-root{
          --bg:#FAF7F2;--bg-warm:#F3EDE3;--bg-card:#FFFFFF;
          --text:#1A1A2E;--text-light:#2E2E48;--text-muted:#6B6B7B;
          --accent:#1B3C73;--accent-dark:#142E5A;--accent-light:#E8EFF8;
          --green:#22C55E;--white:#FFFFFF;--radius:20px;
          font-family:'DM Sans',system-ui,sans-serif!important;color:var(--text);background:var(--bg);
          line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh;
        }
        .bestill-root .bst-header{position:sticky;top:0;z-index:50;background:rgba(250,247,242,0.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(26,26,46,0.06)}
        .bestill-root .bst-header-inner{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;max-width:600px;margin:0 auto}
        .bestill-root .bst-header-phone{display:flex;align-items:center;gap:6px;color:var(--text);font-weight:600;font-size:14px;text-decoration:none;transition:color .2s}
        .bestill-root .bst-header-phone:hover{color:var(--accent)}
        .bestill-root .bst-container{max-width:600px;margin:0 auto;padding:0 20px 40px}
        .bestill-root .bst-hero{text-align:center;padding:36px 0 28px}
        .bestill-root .bst-hero-label{font-family:'Caveat',cursive;color:var(--accent);font-size:20px;margin-bottom:6px}
        .bestill-root .bst-hero h1{font-size:clamp(26px,5.5vw,36px);font-weight:900;line-height:1.1;letter-spacing:-1.5px;margin-bottom:14px}
        .bestill-root .bst-hero p{font-size:16px;color:var(--text-muted);max-width:440px;margin:0 auto;line-height:1.6}
        .bestill-root .bst-steps{display:flex;align-items:center;margin-bottom:24px;padding:0 4px}
        .bestill-root .bst-step-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border:2px solid rgba(26,26,46,0.1);color:var(--text-muted);background:var(--bg-card);transition:all .3s;flex-shrink:0}
        .bestill-root .bst-step-dot.active{background:var(--accent);border-color:var(--accent);color:var(--white)}
        .bestill-root .bst-step-dot.done{background:var(--green);border-color:var(--green);color:var(--white)}
        .bestill-root .bst-step-line{flex:1;height:2px;background:rgba(26,26,46,0.08);transition:background .3s}
        .bestill-root .bst-step-line.done{background:var(--green)}
        .bestill-root .bst-step-labels{display:flex;justify-content:space-between;margin:-8px 0 24px;padding:0 2px}
        .bestill-root .bst-step-lbl{font-size:11px;font-weight:600;color:var(--text-muted);text-align:center;width:60px}
        .bestill-root .bst-step-lbl.active{color:var(--accent)}
        .bestill-root .bst-card{background:var(--bg-card);border:1px solid rgba(26,26,46,0.06);border-radius:var(--radius);padding:28px 24px;margin-bottom:24px}
        .bestill-root .bst-card h2{font-size:20px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px}
        .bestill-root .bst-card .bst-sub{font-size:14px;color:var(--text-muted);margin-bottom:24px}
        .bestill-root .bst-field{margin-bottom:16px}
        .bestill-root .bst-field label{display:block;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
        .bestill-root .bst-field input,.bestill-root .bst-field select{width:100%;border:2px solid #EDE8DF;border-radius:12px;padding:14px 16px;font-size:16px;font-family:inherit;color:var(--text);background:var(--bg-warm);transition:border-color .2s,background .2s;outline:none}
        .bestill-root .bst-field input:focus,.bestill-root .bst-field select:focus{border-color:var(--accent);background:var(--white)}
        .bestill-root .bst-field input::placeholder{color:#B5AFA5}
        .bestill-root .bst-field input.error{border-color:#EF4444}
        .bestill-root .bst-field select{appearance:auto;cursor:pointer}
        .bestill-root .bst-field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .bestill-root .bst-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:16px 32px;border-radius:50px;font-weight:700;font-size:15px;border:none;cursor:pointer;transition:transform .2s,box-shadow .2s;font-family:inherit;text-decoration:none;width:100%}
        .bestill-root .bst-btn:hover{transform:translateY(-2px)}
        .bestill-root .bst-btn:active{transform:translateY(0)}
        .bestill-root .bst-btn-dark{background:var(--text);color:var(--white)}
        .bestill-root .bst-btn-dark:hover{box-shadow:0 8px 24px rgba(26,26,46,0.2)}
        .bestill-root .bst-btn-dark:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none}
        .bestill-root .bst-btn-ghost{background:none;border:none;color:var(--text-muted);font-size:14px;font-weight:500;cursor:pointer;padding:12px;width:100%;font-family:inherit;transition:color .2s}
        .bestill-root .bst-btn-ghost:hover{color:var(--text)}
        .bestill-root .bst-date-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:24px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
        .bestill-root .bst-date-strip::-webkit-scrollbar{display:none}
        .bestill-root .bst-date-chip{flex-shrink:0;padding:12px 16px;border-radius:16px;border:2px solid rgba(26,26,46,0.08);background:var(--bg-card);text-align:center;cursor:pointer;transition:all .2s;min-width:68px}
        .bestill-root .bst-date-chip:hover{border-color:var(--accent);background:var(--accent-light)}
        .bestill-root .bst-date-chip.selected{background:var(--accent);border-color:var(--accent);color:var(--white)}
        .bestill-root .bst-date-chip .day{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;color:var(--text-muted)}
        .bestill-root .bst-date-chip.selected .day{color:rgba(255,255,255,0.7)}
        .bestill-root .bst-date-chip .num{font-size:20px;font-weight:900;letter-spacing:-0.5px}
        .bestill-root .bst-date-chip .month{font-size:11px;font-weight:500;color:var(--text-muted)}
        .bestill-root .bst-date-chip.selected .month{color:rgba(255,255,255,0.7)}
        .bestill-root .bst-time-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
        .bestill-root .bst-time-slot{padding:16px;border-radius:16px;border:2px solid rgba(26,26,46,0.08);background:var(--bg-card);text-align:center;cursor:pointer;transition:all .2s;font-size:16px;font-weight:700}
        .bestill-root .bst-time-slot:hover{border-color:var(--accent);background:var(--accent-light)}
        .bestill-root .bst-time-slot.selected{background:var(--accent);border-color:var(--accent);color:var(--white)}
        .bestill-root .bst-time-slot .slot-label{font-size:11px;font-weight:500;color:var(--text-muted);margin-top:2px}
        .bestill-root .bst-time-slot.selected .slot-label{color:rgba(255,255,255,0.7)}
        .bestill-root .bst-confirmation{text-align:center;padding:48px 20px}
        .bestill-root .bst-conf-icon{width:80px;height:80px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;animation:bstPopIn .5s cubic-bezier(0.34,1.56,0.64,1)}
        @keyframes bstPopIn{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
        .bestill-root .bst-conf-icon svg{width:40px;height:40px;color:var(--green)}
        .bestill-root .bst-confirmation h2{font-size:clamp(24px,4vw,32px);font-weight:900;letter-spacing:-1px;margin-bottom:8px}
        .bestill-root .bst-confirmation .bst-conf-text{font-size:16px;color:var(--text-muted);margin-bottom:28px;line-height:1.6}
        .bestill-root .bst-conf-details{background:var(--bg-card);border:1px solid rgba(26,26,46,0.06);border-radius:var(--radius);padding:24px;text-align:left;margin-bottom:24px}
        .bestill-root .bst-conf-details h3{font-family:'Caveat',cursive;font-size:18px;color:var(--accent);margin-bottom:16px;font-weight:600}
        .bestill-root .bst-conf-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(26,26,46,0.06);font-size:15px}
        .bestill-root .bst-conf-row:last-child{border-bottom:none}
        .bestill-root .bst-conf-row .label{color:var(--text-muted)}
        .bestill-root .bst-conf-row .value{font-weight:700;color:var(--text)}
        .bestill-root .bst-conf-notice{background:var(--accent-light);border:1px solid rgba(27,60,115,0.1);border-radius:16px;padding:20px;font-size:14px;color:var(--text-light);line-height:1.6;text-align:left}
        .bestill-root .bst-conf-notice strong{color:var(--accent);display:block;margin-bottom:4px}
        .bestill-root .bst-footer{background:var(--text);color:var(--white);padding:32px 20px;margin-top:32px}
        .bestill-root .bst-footer-inner{max-width:600px;margin:0 auto;text-align:center}
        .bestill-root .bst-footer p{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.8}
        .bestill-root .bst-footer a{color:rgba(255,255,255,0.7);text-decoration:none;transition:color .2s}
        .bestill-root .bst-footer a:hover{color:var(--white)}
        .bestill-root .bst-empty{grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:14px;padding:24px 0}
        @media(max-width:600px){
          .bestill-root .bst-container{padding:0 16px 100px}
          .bestill-root .bst-card{padding:24px 18px}
          .bestill-root .bst-field-row{grid-template-columns:1fr}
          .bestill-root .bst-hero{padding:28px 0 20px}
          .bestill-root .bst-hero h1{font-size:26px}
          .bestill-root .bst-hero p{font-size:15px}
          .bestill-root .bst-header-inner{padding:12px 16px}
          .bestill-root .bst-header-inner svg{width:110px}
          .bestill-root .bst-header-phone{font-size:13px}
          .bestill-root .bst-steps{margin-bottom:16px}
          .bestill-root .bst-step-labels{margin:-4px 0 16px}
          .bestill-root .bst-date-chip{padding:10px 12px;min-width:58px}
          .bestill-root .bst-date-chip .num{font-size:18px}
          .bestill-root .bst-time-grid{gap:8px}
          .bestill-root .bst-time-slot{padding:12px 8px;font-size:15px}
          .bestill-root .bst-time-slot .slot-label{font-size:10px}
          .bestill-root .bst-conf-details{padding:20px 18px}
          .bestill-root .bst-conf-row{font-size:14px}
          .bestill-root .bst-footer{padding-bottom:calc(32px + env(safe-area-inset-bottom,16px))}
        }
        @media(max-width:375px){
          .bestill-root .bst-hero h1{font-size:23px;letter-spacing:-1px}
          .bestill-root .bst-time-grid{grid-template-columns:1fr 1fr;gap:8px}
          .bestill-root .bst-date-chip{padding:8px 10px;min-width:52px}
          .bestill-root .bst-date-chip .num{font-size:16px}
          .bestill-root .bst-date-chip .day,.bestill-root .bst-date-chip .month{font-size:10px}
        }
      `}</style>

      <div className="bestill-root">
        {/* HEADER */}
        <header className="bst-header">
          <div className="bst-header-inner">
            <a href="/bestill" style={{ textDecoration: 'none' }}>
              <svg viewBox="0 0 180 100" width={130} style={{ verticalAlign: 'middle', marginTop: -4 }} xmlns="http://www.w3.org/2000/svg">
                <path d="M72,12 Q90,4 108,12" fill="none" stroke="#1B3C73" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M78,4 Q90,-2 102,4" fill="none" stroke="#1B3C73" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
                <text x="90" y="42" fontFamily="'DM Sans',sans-serif" fontWeight="900" fontSize="26" fill="#1A1A2E" textAnchor="middle" letterSpacing="-1">Godt</text>
                <text x="90" y="70" fontFamily="'DM Sans',sans-serif" fontWeight="700" fontSize="22" fill="#1A1A2E" textAnchor="middle" letterSpacing="0.5">Vedlikehold</text>
              </svg>
            </a>
            <a href="tel:+4793672506" className="bst-header-phone">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              936 72 506
            </a>
          </div>
        </header>

        <div className="bst-container">
          {/* HERO */}
          <div className="bst-hero">
            <div className="bst-hero-label">Profesjonell ventilasjonsrens</div>
            <h1>Bestill Ventilasjonsrens</h1>
            <p>Velg dato og tid &mdash; vi fikser resten.</p>
          </div>

          {/* STEP INDICATOR */}
          <div className="bst-steps">
            <div className={`bst-step-dot ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>{step > 1 ? '\u2713' : '1'}</div>
            <div className={`bst-step-line ${step > 1 ? 'done' : ''}`} />
            <div className={`bst-step-dot ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>{step > 2 ? '\u2713' : '2'}</div>
            <div className={`bst-step-line ${step > 2 ? 'done' : ''}`} />
            <div className={`bst-step-dot ${step === 3 ? 'done' : ''}`}>{step === 3 ? '\u2713' : '3'}</div>
          </div>
          <div className="bst-step-labels">
            <span className={`bst-step-lbl ${step === 1 ? 'active' : ''}`}>Opplysninger</span>
            <span className={`bst-step-lbl ${step === 2 ? 'active' : ''}`}>Velg tid</span>
            <span className={`bst-step-lbl ${step === 3 ? 'active' : ''}`}>Bekreftelse</span>
          </div>

          {/* STEP 1: FORM */}
          {step === 1 && (
            <div className="bst-card">
              <h2>Dine opplysninger</h2>
              <p className="bst-sub">Vi trenger litt info for &aring; booke tiden din</p>

              <div className="bst-field">
                <label htmlFor="name">Fullt navn</label>
                <input
                  type="text" id="name" placeholder="Ola Nordmann" autoComplete="name"
                  className={nameError ? 'error' : ''}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(false); }}
                />
              </div>

              <div className="bst-field-row">
                <div className="bst-field">
                  <label htmlFor="phone">Telefon</label>
                  <input
                    type="tel" id="phone" placeholder="412 34 567" autoComplete="tel"
                    className={phoneError ? 'error' : ''}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError(false); }}
                  />
                </div>
                <div className="bst-field">
                  <label htmlFor="email">E-post</label>
                  <input
                    type="email" id="email" placeholder="ola@epost.no" autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="bst-field">
                <label htmlFor="address">Adresse</label>
                <input
                  type="text" id="address" placeholder="Margarethas vei 1" autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="bst-field-row">
                <div className="bst-field">
                  <label htmlFor="postnr">Postnummer</label>
                  <input
                    type="text" id="postnr" placeholder="0192" inputMode="numeric" maxLength={4} autoComplete="postal-code"
                    value={postnr}
                    onChange={(e) => setPostnr(e.target.value)}
                  />
                </div>
                <div className="bst-field">
                  <label htmlFor="floor">Etasje</label>
                  <select id="floor" value={floor} onChange={(e) => setFloor(e.target.value)}>
                    <option value="">Velg etasje</option>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={`${n}. etasje`}>{n}. etasje</option>
                    ))}
                  </select>
                </div>
              </div>

              <button className="bst-btn bst-btn-dark" onClick={goToStep2} disabled={loading}>
                {loading ? 'Henter ledige tider\u2026' : (
                  <>
                    Velg tid
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: CALENDAR */}
          {step === 2 && (
            <div className="bst-card">
              <h2>Velg dato og tid</h2>
              <p className="bst-sub">Ledige tider for ventilasjonsrens i ditt omr&aring;de</p>

              <div className="bst-date-strip">
                {dateKeys.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '24px 0', width: '100%' }}>
                    Ingen ledige tider tilgjengelig
                  </p>
                ) : dateKeys.map((key) => {
                  const info = formatDateKey(key);
                  return (
                    <div
                      key={key}
                      className={`bst-date-chip ${selDateKey === key ? 'selected' : ''}`}
                      onClick={() => { setSelDateKey(key); setSelTime(null); }}
                    >
                      <div className="day">{info.dayName}</div>
                      <div className="num">{info.dayNum}</div>
                      <div className="month">{info.monthName}</div>
                    </div>
                  );
                })}
              </div>

              <div className="bst-time-grid">
                {!selDateKey ? (
                  <p className="bst-empty">Velg en dato for &aring; se ledige tider</p>
                ) : currentSlots.length === 0 ? (
                  <p className="bst-empty">Ingen ledige tider denne dagen</p>
                ) : currentSlots.map((s) => (
                  <div
                    key={s.time}
                    className={`bst-time-slot ${selTime?.time === s.time ? 'selected' : ''}`}
                    onClick={() => setSelTime(s)}
                  >
                    <div>{s.time}</div>
                    <div className="slot-label">{getTimeLabel(s.minutes)}</div>
                  </div>
                ))}
              </div>

              <button
                className="bst-btn bst-btn-dark"
                onClick={goToStep3}
                disabled={!selDateKey || !selTime || submitting}
                style={{ marginTop: 24 }}
              >
                {submitting ? 'Sender bestilling\u2026' : (
                  <>
                    Bekreft booking
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </>
                )}
              </button>
              <button className="bst-btn-ghost" onClick={() => { setStep(1); setSelDateKey(null); setSelTime(null); }}>
                &larr; Tilbake
              </button>
            </div>
          )}

          {/* STEP 3: CONFIRMATION */}
          {step === 3 && (
            <div className="bst-confirmation">
              <div className="bst-conf-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2>Booking bekreftet!</h2>
              <p className="bst-conf-text">Du vil motta en bekreftelse p&aring; e-post med alle detaljer.</p>

              <div className="bst-conf-details">
                <h3>Oppsummering</h3>
                <div className="bst-conf-row"><span className="label">Navn</span><span className="value">{confData.name}</span></div>
                <div className="bst-conf-row"><span className="label">Adresse</span><span className="value">{confData.address}</span></div>
                <div className="bst-conf-row"><span className="label">Dato</span><span className="value">{confData.date}</span></div>
                <div className="bst-conf-row"><span className="label">Tid</span><span className="value">{confData.time}</span></div>
              </div>

              <div className="bst-conf-notice">
                <strong>Hva skjer n&aring;?</strong>
                En av v&aring;re dyktige teknikere tar kontakt f&oslash;r avtalt tid! Jobben tar ca. 1 time. Takk for tilliten!
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="bst-footer">
          <div className="bst-footer-inner">
            <svg viewBox="0 0 180 100" width={120} style={{ verticalAlign: 'middle', marginBottom: 12 }} xmlns="http://www.w3.org/2000/svg">
              <path d="M72,12 Q90,4 108,12" fill="none" stroke="#1B3C73" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M78,4 Q90,-2 102,4" fill="none" stroke="#1B3C73" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
              <text x="90" y="42" fontFamily="'DM Sans',sans-serif" fontWeight="900" fontSize="26" fill="#FFFFFF" textAnchor="middle" letterSpacing="-1">Godt</text>
              <text x="90" y="70" fontFamily="'DM Sans',sans-serif" fontWeight="700" fontSize="22" fill="rgba(255,255,255,.7)" textAnchor="middle" letterSpacing="0.5">Vedlikehold</text>
            </svg>
            <p>
              <a href="mailto:hei@godtvedlikehold.no">hei@godtvedlikehold.no</a> &middot; <a href="tel:+4793672506">936 72 506</a><br/>
              &copy; 2025 Godt Vedlikehold. Alle rettigheter reservert.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
