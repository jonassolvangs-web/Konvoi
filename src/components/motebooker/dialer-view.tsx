'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, MessageSquare, Mail, FileText, Copy, Car, ChevronLeft, ChevronRight, CalendarDays, UserPlus, Pencil, Clock } from 'lucide-react';
import { format, addDays, isWeekend } from 'date-fns';
import { nb } from 'date-fns/locale';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { cn, formatDistance, formatPhone } from '@/lib/utils';
import { saveContact } from '@/lib/vcard';
import toast from 'react-hot-toast';

interface Organization {
  id: string;
  name: string;
  address: string;
  status: string;
  numUnits: number | null;
  buildingYear: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  chairmanEmail: string | null;
  chairmanBirthNumber: string | null;
  distanceFromOfficeKm: number | null;
  distanceFromOfficeMin: number | null;
  notes: string | null;
}

interface DialerViewProps {
  organizations: Organization[];
  feltselgere: { id: string; name: string }[];
  stats: { ringt: number; naadd: number; booket: number; ikkeSvar: number };
  onCallLogged: () => void;
  onSelectOrg?: (org: Organization) => void;
}

function getNext14Days(): Date[] {
  const days: Date[] = [];
  const d = new Date();
  for (let i = 0; i < 21 && days.length < 14; i++) {
    days.push(addDays(d, i));
  }
  return days;
}

function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 15; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  slots.push('16:00');
  return slots;
}

export default function DialerView({ organizations, feltselgere, stats, onCallLogged, onSelectOrg }: DialerViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loggingResult, setLoggingResult] = useState(false);

  // Book meeting
  const [showBookMeeting, setShowBookMeeting] = useState(false);
  const [bookSelectedDate, setBookSelectedDate] = useState<Date | null>(null);
  const [bookSelectedTime, setBookSelectedTime] = useState<string | null>(null);
  const [bookSelectedFeltselger, setBookSelectedFeltselger] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // SMS
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsText, setSmsText] = useState('');

  // Email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  // Notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<{ id: string; notes: string; createdAt: string }[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // Callback
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [callbackDay, setCallbackDay] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackMethod, setCallbackMethod] = useState<'ring' | 'mail'>('ring');
  const [callbackEmailSubject, setCallbackEmailSubject] = useState('');
  const [callbackEmailBody, setCallbackEmailBody] = useState('');

  // Swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  if (organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Ingen adresser å vise</p>
      </div>
    );
  }

  const org = organizations[currentIndex];

  const prev = () => { setCurrentIndex((i) => Math.max(0, i - 1)); };
  const next = () => { setCurrentIndex((i) => Math.min(organizations.length - 1, i + 1)); };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) next();
      else prev();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert');
  };

  // ── Log result ──
  const handleLogResult = async (result: string) => {
    if (result === 'ring_tilbake') {
      setShowCallbackPicker(true);
      return;
    }

    setLoggingResult(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, result }),
      });
      if (!res.ok) throw new Error();

      const labels: Record<string, string> = {
        mote_booket: 'Fullført',
        ikke_svar: 'Ingen svar',
        mail_sendt: 'Mail sendt',
        nei: 'Nei',
      };
      toast.success(labels[result] || 'Logget');
      onCallLogged();
      if (currentIndex < organizations.length - 1) setCurrentIndex((i) => i + 1);
    } catch {
      toast.error('Kunne ikke logge resultat');
    } finally {
      setLoggingResult(false);
    }
  };

  const handleLogCallback = async () => {
    if (!callbackDay || !callbackTime) return;
    setLoggingResult(true);
    try {
      const callbackAt = new Date(`${callbackDay}T${callbackTime}:00`).toISOString();

      if (callbackMethod === 'mail' && callbackEmailBody) {
        if (org.chairmanEmail) {
          const subject = encodeURIComponent(callbackEmailSubject);
          const body = encodeURIComponent(callbackEmailBody);
          window.open(`mailto:${org.chairmanEmail}?subject=${subject}&body=${body}`, '_blank');
        }
        const res = await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: org.id,
            result: 'mail_sendt',
            callbackAt,
            notes: `Oppfølging planlagt: ${callbackEmailSubject}`,
          }),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: org.id, result: 'ring_tilbake', callbackAt }),
        });
        if (!res.ok) throw new Error();
      }

      toast.success(callbackMethod === 'mail' ? 'E-post åpnet og oppfølging lagret' : 'Oppfølging lagret');
      setShowCallbackPicker(false);
      setCallbackDay('');
      setCallbackTime('');
      setCallbackMethod('ring');
      setCallbackEmailSubject('');
      setCallbackEmailBody('');
      onCallLogged();
      if (currentIndex < organizations.length - 1) setCurrentIndex((i) => i + 1);
    } catch {
      toast.error('Kunne ikke lagre oppfølging');
    } finally {
      setLoggingResult(false);
    }
  };

  // ── Book meeting ──
  const openBookMeeting = () => {
    setBookSelectedDate(null);
    setBookSelectedTime(null);
    setBookSelectedFeltselger(feltselgere[0]?.id || '');
    setShowBookMeeting(true);
  };

  const handleBookMeeting = async () => {
    if (!bookSelectedDate || !bookSelectedTime || !bookSelectedFeltselger) {
      toast.error('Velg feltselger, dato og tid');
      return;
    }
    setBookingInProgress(true);
    try {
      const dateStr = format(bookSelectedDate, 'yyyy-MM-dd');
      const scheduledAt = new Date(`${dateStr}T${bookSelectedTime}`).toISOString();
      const aptRes = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, userId: bookSelectedFeltselger, scheduledAt }),
      });
      if (!aptRes.ok) throw new Error();
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, result: 'mote_booket' }),
      });
      toast.success('Møte booket!');
      setShowBookMeeting(false);
      onCallLogged();
      if (currentIndex < organizations.length - 1) setCurrentIndex((i) => i + 1);
    } catch {
      toast.error('Kunne ikke booke møte');
    } finally {
      setBookingInProgress(false);
    }
  };

  // ── SMS ──
  const openSmsModal = () => {
    setSmsText(`Hei, Jonas fra Turbo som prøvde å ringe. Ringte angående "${org.name}". Gjelder ventilasjonsrens. Ring meg gjerne opp når du har mulighet.`);
    setShowSmsModal(true);
  };
  const handleSendSms = () => {
    if (!org.chairmanPhone) { toast.error('Ingen telefonnummer'); return; }
    window.open(`sms:${org.chairmanPhone}?body=${encodeURIComponent(smsText)}`, '_blank');
    toast.success('SMS åpnet');
    setShowSmsModal(false);
  };

  // ── Email ──
  const openEmailModal = () => {
    setEmailSubject(`Ventilasjonsrens — ${org.name}`);
    setEmailBody(`Hei,

Sender som avtalt over informasjon rundt Ventilasjonsrens.

Tilbudet gjelder alle boenheter, og det er opp til hver enkelt beboer om de ønsker å benytte seg av det.

Gratis befaring
Som en del av tjenesten tilbyr vi en uforpliktende befaringsrunde. Det tar 5–10 minutter per boenhet, og gir beboerne mulighet til å se tilstanden på sitt anlegg før de eventuelt bestiller rens. På befaringen vurderer vi om det faktisk er behov for rens — vi anbefaler ikke jobben hvis anlegget er i god stand.

Pris - Rens av ventilasjonsanlegg: kr 4 990,- inkl. mva per boenhet (ordinærpris kr 6 990,-)

Hva inngår i en rens?
Vi renser ventilasjonsanlegget i hver enkelt boenhet. Ventiler demonteres og rengjøres, og kanalsystemet renses mekanisk med børste helt ut til tilkoblingspunktet mot fellesanlegget. Hver beboer mottar en komplett inspeksjonsrapport med før- og etter-bilder på e-post.

Hvorfor rense ventilasjonsanlegget?
• Norges Astma- og Allergiforbund anbefaler rens minimum hvert 3–5. år
• Brannvesenet anbefaler jevnlig rens av hensyn til brannsikkerhet
• Reduserer risiko for slitasjeskader og gir et mer energieffektivt anlegg
• Kan forlenge anleggets levetid med flere år

Dato for Gratis befaring
Når vi finner en dato som passer, så har vi en ferdig e-postmal/flyer vi kan sende over, som enkelt kan videresendes til beboerne :)

Med vennlig hilsen
Jonas Anker Solvang
Ventilasjonskonsulent
47 88 92 46`);
    setEmailCopied(false);
    setShowEmailModal(true);
  };
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Emne: ${emailSubject}\n\n${emailBody}`);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1500);
  };
  const handleSendEmail = async () => {
    if (!org.chairmanEmail) { toast.error('Ingen e-post'); return; }
    window.open(`mailto:${org.chairmanEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`, '_blank');
    setShowEmailModal(false);
    // Auto-log mail_sendt
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, result: 'mail_sendt' }),
      });
      toast.success('Mail sendt registrert');
      onCallLogged();
    } catch {
      toast.success('E-post åpnet');
    }
  };

  // ── Notes ──
  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/calls?organizationId=${org.id}`);
      const data = await res.json();
      setNotes((data.calls || []).filter((c: any) => c.notes));
    } catch { setNotes([]); }
  };
  const openNotesModal = () => { fetchNotes(); setNoteText(''); setShowNotesModal(true); };
  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, result: 'ring_tilbake', notes: noteText.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success('Notat lagret');
      setNoteText('');
      fetchNotes();
    } catch { toast.error('Kunne ikke lagre notat'); }
    finally { setSavingNote(false); }
  };

  const days = getNext14Days();
  const timeSlots = getTimeSlots();

  // Calendar for callback picker — 3 weeks starting from this Monday
  const cbToday = new Date();
  cbToday.setHours(0, 0, 0, 0);
  const cbTodayStr = format(cbToday, 'yyyy-MM-dd');
  const cbDow = cbToday.getDay();
  const cbMonday = addDays(cbToday, cbDow === 0 ? -6 : 1 - cbDow);
  const calendarWeeks: string[][] = [];
  for (let w = 0; w < 3; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(format(addDays(cbMonday, w * 7 + d), 'yyyy-MM-dd'));
    }
    calendarWeeks.push(week);
  }
  const cbTimeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

  const followupEmailTemplates = [
    {
      label: 'Info ventilasjonsrens',
      getSubject: (name: string) => `Ventilasjonsrens — ${name}`,
      getBody: (_name: string) => `Hei,\n\nSender som avtalt over informasjon rundt Ventilasjonsrens.\n\nTilbudet gjelder alle boenheter, og det er opp til hver enkelt beboer om de ønsker å benytte seg av det.\n\nGratis befaring\nSom en del av tjenesten tilbyr vi en uforpliktende befaringsrunde. Det tar 5–10 minutter per boenhet, og gir beboerne mulighet til å se tilstanden på sitt anlegg før de eventuelt bestiller rens. På befaringen vurderer vi om det faktisk er behov for rens — vi anbefaler ikke jobben hvis anlegget er i god stand.\n\nPris - Rens av ventilasjonsanlegg: kr 4 990,- inkl. mva per boenhet (ordinærpris kr 6 990,-)\n\nHva inngår i en rens?\nVi renser ventilasjonsanlegget i hver enkelt boenhet. Ventiler demonteres og rengjøres, og kanalsystemet renses mekanisk med børste helt ut til tilkoblingspunktet mot fellesanlegget. Hver beboer mottar en komplett inspeksjonsrapport med før- og etter-bilder på e-post.\n\nHvorfor rense ventilasjonsanlegget?\n• Norges Astma- og Allergiforbund anbefaler rens minimum hvert 3–5. år\n• Brannvesenet anbefaler jevnlig rens av hensyn til brannsikkerhet\n• Reduserer risiko for slitasjeskader og gir et mer energieffektivt anlegg\n• Kan forlenge anleggets levetid med flere år\n\nDato for Gratis befaring\nNår vi finner en dato som passer, så har vi en ferdig e-postmal/flyer vi kan sende over, som enkelt kan videresendes til beboerne :)\n\nMed vennlig hilsen\nJonas Anker Solvang\nVentilasjonskonsulent\n47 88 92 46`,
    },
    {
      label: 'Oppfølging',
      getSubject: (name: string) => `Oppfølging — ${name}`,
      getBody: (name: string) => `Hei,\n\nViser til vår hyggelige samtale angående ventilasjonsrens for ${name}.\n\nHar styret hatt mulighet til å se over informasjonen vi sendte?\n\nVi tilbyr fortsatt gratis og uforpliktende befaring, der vi vurderer behovet i hver enkelt boenhet. Det tar kun 5–10 minutter per enhet.\n\nTa gjerne kontakt om dere har spørsmål eller ønsker å avtale befaring.\n\nMed vennlig hilsen\nJonas Anker Solvang\nVentilasjonskonsulent\n47 88 92 46`,
    },
    {
      label: 'Påminnelse',
      getSubject: (name: string) => `Påminnelse: Ventilasjonsrens — ${name}`,
      getBody: (name: string) => `Hei,\n\nSender en vennlig påminnelse om tilbudet vårt på ventilasjonsrens for ${name}.\n\nVi har fortsatt ledig kapasitet for gratis befaring i deres område. Befaringen er helt uforpliktende og gir beboerne mulighet til å se tilstanden på sitt ventilasjonsanlegg.\n\nGi gjerne beskjed om dere ønsker å avtale et tidspunkt.\n\nMed vennlig hilsen\nJonas Anker Solvang\nVentilasjonskonsulent\n47 88 92 46`,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center justify-around py-3 border-b border-gray-100 shrink-0">
        {[
          { label: 'Ringt', value: stats.ringt },
          { label: 'Nådd', value: stats.naadd },
          { label: 'Booket', value: stats.booket },
          { label: 'Ikke svar', value: stats.ikkeSvar },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <button onClick={prev} disabled={currentIndex === 0} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs text-gray-400">{currentIndex + 1} / {organizations.length}</span>
        <button onClick={next} disabled={currentIndex >= organizations.length - 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Swipeable org card */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header + inline stats */}
        <button
          className="mb-2 text-left w-full"
          onClick={() => onSelectOrg?.(org)}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold leading-tight">{org.name}</h2>
              <p className="text-xs text-gray-500">{org.address}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {org.numUnits && <span>{org.numUnits} enheter</span>}
                {org.buildingYear && <span>Byggeår {org.buildingYear}</span>}
                {org.distanceFromOfficeKm != null && org.distanceFromOfficeMin != null && (
                  <span className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {formatDistance(org.distanceFromOfficeKm, org.distanceFromOfficeMin)}
                  </span>
                )}
              </div>
            </div>
            {org.numUnits && (
              <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-1.5">
                🏢 {org.numUnits}
              </span>
            )}
          </div>
        </button>

        {/* Notes */}
        {org.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-xs font-medium text-amber-700 uppercase mb-0.5">Notat</p>
            <p className="text-sm text-amber-900">{org.notes}</p>
          </div>
        )}

        {/* Chairman */}
        {org.chairmanName && (
          <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded-lg px-3 py-2.5 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Styreleder</p>
              <p className="text-sm font-semibold text-gray-900">{org.chairmanName}</p>
              {org.chairmanBirthNumber && (
                <p className="text-[11px] text-gray-500">f. {org.chairmanBirthNumber}</p>
              )}
              {org.chairmanPhone && (
                <div className="flex items-center gap-1.5">
                  <a href={`tel:${org.chairmanPhone}`} className="text-xs text-blue-600">
                    {formatPhone(org.chairmanPhone)}
                  </a>
                  <button onClick={() => copyToClipboard(org.chairmanPhone!)} className="p-0.5 rounded hover:bg-gray-200">
                    <Copy className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              )}
              {org.chairmanEmail && (
                <div className="flex items-center gap-1.5">
                  <a href={`mailto:${org.chairmanEmail}`} className="text-xs text-blue-600 truncate">
                    {org.chairmanEmail}
                  </a>
                  <button onClick={() => copyToClipboard(org.chairmanEmail!)} className="p-0.5 rounded hover:bg-gray-200">
                    <Copy className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onSelectOrg?.(org)}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-500" />
              </button>
              {org.chairmanPhone && (
                <a
                  href={`tel:${org.chairmanPhone}`}
                  onClick={() => {
                    if (org.chairmanName && org.chairmanPhone) {
                      saveContact({
                        name: org.chairmanName,
                        phone: org.chairmanPhone,
                        email: org.chairmanEmail,
                        organization: org.name,
                        address: org.address,
                      });
                    }
                  }}
                  className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
                >
                  <Phone className="w-[18px] h-[18px] text-white" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Action buttons - same as kart bottom sheet */}
        <div className="space-y-2 mb-3">
          {org.chairmanPhone && (
            <a
              href={`tel:${org.chairmanPhone}`}
              onClick={() => {
                if (org.chairmanName && org.chairmanPhone) {
                  saveContact({
                    name: org.chairmanName,
                    phone: org.chairmanPhone,
                    email: org.chairmanEmail,
                    organization: org.name,
                    address: org.address,
                  });
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-black text-white rounded-xl hover:bg-gray-800 font-medium text-sm py-3 px-4 active:scale-[0.97] transition-all"
            >
              <Phone className="w-4 h-4" />Ring
            </a>
          )}
          <div className="flex gap-2">
            <button onClick={openEmailModal} className="w-full flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm py-2.5 px-3 active:scale-[0.97] transition-all">
              <Mail className="w-4 h-4" />Send mail
            </button>
            <button onClick={() => setShowCallbackPicker(true)} className="w-full flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm py-2.5 px-3 active:scale-[0.97] transition-all">
              <Clock className="w-4 h-4" />Callback
            </button>
          </div>
          <button onClick={openSmsModal} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm py-2.5 px-3 active:scale-[0.97] transition-all">
            <MessageSquare className="w-4 h-4" />Send SMS
          </button>
        </div>
      </div>

      {/* ── Callback picker modal ── */}
      <Modal isOpen={showCallbackPicker} onClose={() => setShowCallbackPicker(false)} title="Planlegg oppfølging" size="lg">
        <div className="space-y-4">
          {/* Method selector */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Hvordan følge opp?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setCallbackMethod('ring'); setCallbackEmailSubject(''); setCallbackEmailBody(''); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                  callbackMethod === 'ring'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                )}
              >
                <Phone className="w-4 h-4" />Ring
              </button>
              <button
                onClick={() => setCallbackMethod('mail')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                  callbackMethod === 'mail'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                )}
              >
                <Mail className="w-4 h-4" />Send mail
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Velg dag</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {calendarWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((dayStr) => {
                    const isPast = dayStr < cbTodayStr;
                    const isToday = dayStr === cbTodayStr;
                    const isSelected = dayStr === callbackDay;
                    const dayNum = parseInt(dayStr.slice(8), 10);
                    return (
                      <button
                        key={dayStr}
                        disabled={isPast}
                        onClick={() => setCallbackDay(dayStr)}
                        className={cn(
                          'h-10 rounded-lg text-sm font-medium transition-colors',
                          isPast && 'text-gray-300 cursor-not-allowed',
                          !isPast && !isSelected && 'text-gray-700 hover:bg-gray-200',
                          isToday && !isSelected && 'ring-2 ring-black ring-inset',
                          isSelected && 'bg-black text-white'
                        )}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Time slots */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Velg tid</p>
            <div className="flex flex-wrap gap-2">
              {cbTimeSlots.map((t) => (
                <button
                  key={t}
                  onClick={() => setCallbackTime(t)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors',
                    callbackTime === t
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Email templates (only when mail method) */}
          {callbackMethod === 'mail' && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Velg e-postmal</p>
                <div className="flex flex-wrap gap-2">
                  {followupEmailTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCallbackEmailSubject(tpl.getSubject(org.name || ''));
                        setCallbackEmailBody(tpl.getBody(org.name || ''));
                      }}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-xl border transition-colors',
                        callbackEmailSubject === tpl.getSubject(org.name || '')
                          ? 'bg-black text-white border-black'
                          : 'border-gray-200 hover:border-black hover:bg-gray-50'
                      )}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              {callbackEmailBody && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={callbackEmailSubject}
                    onChange={(e) => setCallbackEmailSubject(e.target.value)}
                    className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    style={{ fontSize: 16 }}
                    placeholder="Emne"
                  />
                  <textarea
                    value={callbackEmailBody}
                    onChange={(e) => setCallbackEmailBody(e.target.value)}
                    rows={6}
                    className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 resize-none outline-none focus:border-blue-400"
                    style={{ fontSize: 16 }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <Button
            fullWidth
            onClick={handleLogCallback}
            isLoading={loggingResult}
            disabled={!callbackDay || !callbackTime || (callbackMethod === 'mail' && !callbackEmailBody)}
          >
            {callbackMethod === 'mail' ? 'Send mail og lagre' : 'Lagre oppfølging'}
          </Button>
        </div>
      </Modal>

      {/* ── Book meeting modal ── */}
      <Modal isOpen={showBookMeeting} onClose={() => setShowBookMeeting(false)} title="Book møte" size="lg">
        <div className="space-y-5">
          <div>
            <label className="label">Feltselger</label>
            <select value={bookSelectedFeltselger} onChange={(e) => setBookSelectedFeltselger(e.target.value)} className="input-field w-full">
              <option value="">Velg feltselger</option>
              {feltselgere.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Dato</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {days.map((day) => {
                const isWknd = isWeekend(day);
                const isSelected = bookSelectedDate && format(bookSelectedDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                return (
                  <button key={day.toISOString()} onClick={() => !isWknd && setBookSelectedDate(day)} disabled={isWknd}
                    className={cn('flex flex-col items-center min-w-[52px] px-2 py-2 rounded-xl text-xs transition-colors',
                      isWknd && 'opacity-30 cursor-not-allowed',
                      isSelected ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100')}>
                    <span className="font-medium">{format(day, 'EEE', { locale: nb })}</span>
                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                    <span>{format(day, 'MMM', { locale: nb })}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {bookSelectedDate && (
            <div>
              <label className="label">Tid</label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <button key={slot} onClick={() => setBookSelectedTime(slot)}
                    className={cn('py-2 rounded-xl text-sm font-medium transition-colors',
                      bookSelectedTime === slot ? 'bg-black text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100')}>
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button fullWidth onClick={handleBookMeeting} isLoading={bookingInProgress}
            disabled={!bookSelectedDate || !bookSelectedTime || !bookSelectedFeltselger}>
            {bookSelectedDate && bookSelectedTime
              ? `Book møte ${format(bookSelectedDate, 'EEEE d. MMMM', { locale: nb })} kl ${bookSelectedTime}`
              : 'Velg dato og tid'}
          </Button>
        </div>
      </Modal>

      {/* ── SMS modal ── */}
      <Modal isOpen={showSmsModal} onClose={() => setShowSmsModal(false)} title="Send SMS">
        <div className="space-y-4">
          <div>
            <label className="label">Til</label>
            <p className="text-sm text-gray-700">{org.chairmanName} ({org.chairmanPhone || 'Ingen nummer'})</p>
          </div>
          <div>
            <label className="label">Melding</label>
            <textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={4} className="input-field w-full resize-none" />
          </div>
          <Button fullWidth onClick={handleSendSms}>Send SMS</Button>
        </div>
      </Modal>

      {/* ── Email preview modal ── */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title={`Mail-mal — ${org.name}`}>
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">Emne</p>
            <p className="text-sm font-medium text-gray-800">{emailSubject}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-3 max-h-72 overflow-y-auto">
            <p className="text-sm text-gray-800 whitespace-pre-line">{emailBody}</p>
          </div>
          <div className="flex gap-3">
            <Button fullWidth variant="secondary" onClick={handleCopyEmail}>
              {emailCopied ? 'Kopiert!' : 'Kopier tekst'}
            </Button>
            <Button fullWidth onClick={handleSendEmail}>Åpne i e-post</Button>
          </div>
        </div>
      </Modal>

      {/* ── Notes modal ── */}
      <Modal isOpen={showNotesModal} onClose={() => setShowNotesModal(false)} title="Notater">
        <div className="space-y-4">
          {notes.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-sm text-gray-800">{n.notes}</p>
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(n.createdAt), 'd. MMM yyyy HH:mm', { locale: nb })}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Ingen notater ennå</p>
          )}
          <div>
            <label className="label">Nytt notat</label>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Skriv notat..." className="input-field w-full resize-none" />
          </div>
          <Button fullWidth onClick={handleSaveNote} isLoading={savingNote} disabled={!noteText.trim()}>Lagre</Button>
        </div>
      </Modal>
    </div>
  );
}
