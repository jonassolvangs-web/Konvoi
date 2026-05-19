'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Search, Phone, Mail, Clock, MessageSquareText, CheckCircle2, Eye, Users, Calendar, Home, Pencil } from 'lucide-react';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES, computePipelineStage, getStage } from '@/lib/pipeline';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface Organization {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  numUnits: number | null;
  buildingYear: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  chairmanEmail: string | null;
  assignedToId: string | null;
  notes: string | null;
}

interface CallRecord {
  id: string;
  organizationId: string;
  result: string;
  notes: string | null;
  createdAt: string;
  callbackAt: string | null;
}

interface PipelineOrg extends Organization {
  pipelineStage: string;
  latestCallResult: string | null;
  latestCallNotes: string | null;
  latestCallDate: string | null;
}

export default function PipelinePage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [organizations, setOrganizations] = useState<PipelineOrg[]>([]);
  const [feltselgere, setFeltselgere] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState('ikke_ringt');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showBookMeeting, setShowBookMeeting] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [modalOrg, setModalOrg] = useState<PipelineOrg | null>(null);

  // Book meeting state
  const [bookSelectedDate, setBookSelectedDate] = useState<Date | null>(null);
  const [bookSelectedTime, setBookSelectedTime] = useState<string | null>(null);
  const [bookSelectedFeltselger, setBookSelectedFeltselger] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // SMS state
  const [smsText, setSmsText] = useState('');
  const [smsTemplates, setSmsTemplates] = useState<{ id: string; title: string; body: string }[]>([]);

  // Email state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  // Callback state
  const [callbackDay, setCallbackDay] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackMethod, setCallbackMethod] = useState<'ring' | 'mail'>('ring');
  const [callbackEmailSubject, setCallbackEmailSubject] = useState('');
  const [callbackEmailBody, setCallbackEmailBody] = useState('');
  const [loggingResult, setLoggingResult] = useState(false);

  // Inline notes state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Inline org edit state
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ name: '', chairmanName: '', chairmanPhone: '', chairmanEmail: '' });
  const [savingOrg, setSavingOrg] = useState(false);

  // Swipe gesture
  const touchStartX = useRef(0);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [orgRes, callRes, userRes] = await Promise.all([
        fetch(`/api/organizations?limit=500&assignedTo=${userId}`),
        fetch('/api/calls'),
        fetch('/api/users?role=FELTSELGER'),
      ]);
      const orgData = await orgRes.json();
      const callData = await callRes.json();
      const userData = await userRes.json();

      setFeltselgere((userData.users || []).map((u: any) => ({ id: u.id, name: u.name })));

      const orgs: Organization[] = orgData.organizations || [];
      const calls: CallRecord[] = callData.calls || [];

      // Build latest call per org (calls are ordered desc by createdAt)
      const latestCallPerOrg: Record<string, CallRecord> = {};
      for (const call of calls) {
        if (!latestCallPerOrg[call.organizationId]) {
          latestCallPerOrg[call.organizationId] = call;
        }
      }

      // Compute pipeline stage per org
      const pipelineOrgs: PipelineOrg[] = orgs.map((org) => {
        const latestCall = latestCallPerOrg[org.id] || null;
        const hasFeltselger = !!org.assignedToId && org.assignedToId !== userId;
        const stage = computePipelineStage(latestCall?.result || null, hasFeltselger);
        return {
          ...org,
          pipelineStage: stage,
          latestCallResult: latestCall?.result || null,
          latestCallNotes: latestCall?.notes || null,
          latestCallDate: latestCall?.createdAt || null,
        };
      });

      setOrganizations(pipelineOrgs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Swipe gestures for mobile
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      const idx = PIPELINE_STAGES.findIndex((s) => s.key === activeStep);
      if (Math.abs(diff) > 80) {
        if (diff < 0 && idx < PIPELINE_STAGES.length - 1) setActiveStep(PIPELINE_STAGES[idx + 1].key);
        if (diff > 0 && idx > 0) setActiveStep(PIPELINE_STAGES[idx - 1].key);
      }
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeStep]);

  // Stage counts
  const stageCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => {
    stageCounts[s.key] = organizations.filter((o) => o.pipelineStage === s.key).length;
  });

  // Filtered orgs for active step
  const activeIdx = PIPELINE_STAGES.findIndex((s) => s.key === activeStep);
  const activeStage = PIPELINE_STAGES[activeIdx];
  let filteredOrgs = organizations.filter((o) => o.pipelineStage === activeStep);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredOrgs = filteredOrgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        (o.chairmanName && o.chairmanName.toLowerCase().includes(q))
    );
  }

  // ── Log result ──
  const handleLogResult = async (org: PipelineOrg, result: string) => {
    if (result === 'ring_tilbake') {
      setModalOrg(org);
      setCallbackDay('');
      setCallbackTime('');
      setCallbackMethod('ring');
      setCallbackEmailSubject('');
      setCallbackEmailBody('');
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

      const resultLabels: Record<string, string> = {
        mote_booket: 'Fullført',
        ikke_svar: 'Ingen svar',
        mail_sendt: 'Mail sendt',
        nei: 'Nei',
        videresendt: 'Videresendt',
      };
      toast.success(resultLabels[result] || 'Logget');
      fetchData();
    } catch {
      toast.error('Kunne ikke logge resultat');
    } finally {
      setLoggingResult(false);
    }
  };

  const handleLogCallback = async () => {
    if (!modalOrg || !callbackDay || !callbackTime) return;
    setLoggingResult(true);
    try {
      const callbackAt = new Date(`${callbackDay}T${callbackTime}:00`).toISOString();

      if (callbackMethod === 'mail' && callbackEmailBody) {
        // Open email client
        if (modalOrg.chairmanEmail) {
          const subject = encodeURIComponent(callbackEmailSubject);
          const body = encodeURIComponent(callbackEmailBody);
          window.open(`mailto:${modalOrg.chairmanEmail}?subject=${subject}&body=${body}`, '_blank');
        }
        // Log as mail_sendt with callback reminder
        const res = await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: modalOrg.id,
            result: 'mail_sendt',
            callbackAt,
            notes: `Oppfølging planlagt: ${callbackEmailSubject}`,
          }),
        });
        if (!res.ok) throw new Error();
      } else {
        // Log as ring_tilbake
        const res = await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: modalOrg.id,
            result: 'ring_tilbake',
            callbackAt,
          }),
        });
        if (!res.ok) throw new Error();
      }

      toast.success(callbackMethod === 'mail' ? 'E-post åpnet og oppfølging lagret' : 'Oppfølging lagret');
      setShowCallbackPicker(false);
      setModalOrg(null);
      setCallbackDay('');
      setCallbackTime('');
      setCallbackMethod('ring');
      setCallbackEmailSubject('');
      setCallbackEmailBody('');
      fetchData();
    } catch {
      toast.error('Kunne ikke lagre oppfølging');
    } finally {
      setLoggingResult(false);
    }
  };

  // ── Book meeting ──
  const handleOpenBookMeeting = (org: PipelineOrg) => {
    setModalOrg(org);
    setBookSelectedDate(null);
    setBookSelectedTime(null);
    setBookSelectedFeltselger(feltselgere[0]?.id || '');
    setShowBookMeeting(true);
  };

  const handleBookMeeting = async () => {
    if (!modalOrg || !bookSelectedDate || !bookSelectedTime || !bookSelectedFeltselger) {
      toast.error('Velg feltselger, dato og tid');
      return;
    }
    setBookingInProgress(true);
    try {
      const dateStr = format(bookSelectedDate, 'yyyy-MM-dd');
      const scheduledAt = new Date(`${dateStr}T${bookSelectedTime}`).toISOString();

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: modalOrg.id,
          userId: bookSelectedFeltselger,
          scheduledAt,
        }),
      });
      if (!res.ok) throw new Error();

      // Also log call result
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: modalOrg.id, result: 'mote_booket' }),
      });

      toast.success('Møte booket!');
      setShowBookMeeting(false);
      setModalOrg(null);
      setBookSelectedDate(null);
      setBookSelectedTime(null);
      setBookSelectedFeltselger('');
      fetchData();
    } catch {
      toast.error('Kunne ikke booke møte');
    } finally {
      setBookingInProgress(false);
    }
  };

  // ── SMS ──
  const replaceVariables = (text: string, org: PipelineOrg) => {
    const userName = (session?.user as any)?.name || '';
    return text
      .replace(/\{\{navn\}\}/g, org.name || '')
      .replace(/\{\{adresse\}\}/g, org.address || '')
      .replace(/\{\{enheter\}\}/g, String(org.numUnits || ''))
      .replace(/\{\{selger\}\}/g, userName);
  };

  const openSmsModal = async (org: PipelineOrg) => {
    setModalOrg(org);
    setSmsText(
      `Hei, Jonas fra Turbo som prøvde å ringe. Ringte angående "${org.name}". Gjelder ventilasjonsrens. Ring meg gjerne opp når du har mulighet.`
    );
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setSmsTemplates((data.templates || []).filter((t: any) => t.type === 'sms'));
    } catch {
      setSmsTemplates([]);
    }
    setShowSmsModal(true);
  };

  const handleSendSms = () => {
    if (!modalOrg?.chairmanPhone) {
      toast.error('Ingen telefonnummer registrert');
      return;
    }
    const encoded = encodeURIComponent(smsText);
    window.open(`sms:${modalOrg.chairmanPhone}?body=${encoded}`, '_blank');
    toast.success('SMS åpnet');
    setShowSmsModal(false);
  };

  // ── Email ──
  const openEmailModal = (org: PipelineOrg) => {
    setModalOrg(org);
    setEmailSubject(`Ventilasjonsrens — ${org.name}`);
    setEmailBody(
      `Hei,

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
47 88 92 46`
    );
    setEmailCopied(false);
    setShowEmailModal(true);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Emne: ${emailSubject}\n\n${emailBody}`);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1500);
  };

  const handleSendEmail = async () => {
    if (!modalOrg?.chairmanEmail) {
      toast.error('Ingen e-post registrert');
      return;
    }
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.open(`mailto:${modalOrg.chairmanEmail}?subject=${subject}&body=${body}`, '_blank');
    setShowEmailModal(false);
    // Auto-log mail_sendt
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: modalOrg.id, result: 'mail_sendt' }),
      });
      toast.success('Mail sendt registrert');
      fetchData();
    } catch {
      toast.success('E-post åpnet');
    }
  };

  // ── Assign feltselger (videresendt -> klar) ──
  const handleAssignFeltselger = async (org: PipelineOrg, feltselgerId: string) => {
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: feltselgerId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Feltselger tildelt');
      fetchData();
    } catch {
      toast.error('Kunne ikke tildele feltselger');
    }
  };

  // ── Inline notes ──
  const handleSaveNote = async (org: PipelineOrg) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: org.id,
          result: org.latestCallResult || 'ring_tilbake',
          notes: noteText.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Notat lagret');
      setEditingNoteId(null);
      setNoteText('');
      fetchData();
    } catch {
      toast.error('Kunne ikke lagre notat');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Save org fields ──
  const handleSaveOrgFields = async (org: PipelineOrg) => {
    setSavingOrg(true);
    try {
      const diff: Record<string, string> = {};
      if (editFields.name.trim() !== (org.name || '')) diff.name = editFields.name.trim();
      if (editFields.chairmanName.trim() !== (org.chairmanName || '')) diff.chairmanName = editFields.chairmanName.trim();
      if (editFields.chairmanPhone.trim() !== (org.chairmanPhone || '')) diff.chairmanPhone = editFields.chairmanPhone.trim();
      if (editFields.chairmanEmail.trim() !== (org.chairmanEmail || '')) diff.chairmanEmail = editFields.chairmanEmail.trim();

      if (Object.keys(diff).length === 0) {
        setEditingOrgId(null);
        return;
      }

      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      });
      if (!res.ok) throw new Error();
      toast.success('Oppdatert');
      setEditingOrgId(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke lagre endringer');
    } finally {
      setSavingOrg(false);
    }
  };

  // ── Mark as videresendt ──
  const handleMarkVideresendt = async (org: PipelineOrg) => {
    await handleLogResult(org, 'videresendt');
  };

  if (loading) return <LoadingSpinner />;

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
      {/* Header with search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Søk navn, adresse, styreleder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      {/* Stepper bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="overflow-x-auto no-scrollbar px-4 py-4">
          <div className="flex items-center min-w-[540px] mx-auto" style={{ maxWidth: 700 }}>
            {PIPELINE_STAGES.map((stage, i) => {
              const count = stageCounts[stage.key] || 0;
              const isActive = stage.key === activeStep;
              const isPast = i < activeIdx;

              return (
                <div key={stage.key} className="contents">
                  {/* Connector line */}
                  {i > 0 && (
                    <div
                      className="flex-1 h-[3px] rounded-full mx-1"
                      style={{
                        background: isPast || isActive ? `${PIPELINE_STAGES[i].color}40` : '#E5E7EB',
                      }}
                    />
                  )}
                  {/* Step circle */}
                  <button
                    onClick={() => setActiveStep(stage.key)}
                    className="flex flex-col items-center gap-1 flex-shrink-0 transition-transform active:scale-95"
                    style={{ minWidth: 56 }}
                  >
                    <div
                      className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-[2.5px] transition-all',
                        isActive && 'shadow-lg scale-105'
                      )}
                      style={
                        isActive
                          ? { background: stage.color, borderColor: stage.color, color: '#fff' }
                          : isPast
                            ? { background: stage.colorLight, borderColor: `${stage.color}80`, color: stage.color }
                            : { borderColor: '#E5E7EB', color: '#9CA3AF', background: '#fff' }
                      }
                    >
                      {isActive ? stage.emoji : count}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-semibold leading-tight text-center',
                        isActive ? 'text-gray-900' : 'text-gray-400'
                      )}
                      style={{ maxWidth: 64 }}
                    >
                      {stage.short}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold" style={{ color: stage.color }}>
                        {count}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stage header + cards */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {/* Stage header */}
        {activeStage && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: activeStage.colorLight }}
              >
                {activeStage.emoji}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{activeStage.label}</h2>
                <p className="text-xs text-gray-400">
                  {filteredOrgs.length} borettslag &middot; Steg {activeIdx + 1} av {PIPELINE_STAGES.length}
                </p>
              </div>
            </div>
            {activeStep !== 'klar' && activeIdx < PIPELINE_STAGES.length - 1 && (
              <div className="flex items-center gap-1 text-[10px] text-gray-300 font-medium">
                Neste: {PIPELINE_STAGES[activeIdx + 1]?.short}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Cards grid */}
        {filteredOrgs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrgs.map((org) => (
              <div key={org.id} className="card-animate">
                <PipelineCard
                  org={org}
                  stage={activeStage}
                  feltselgere={feltselgere}
                  editingNoteId={editingNoteId}
                  noteText={noteText}
                  savingNote={savingNote}
                  onEditNote={(id) => {
                    setEditingOrgId(null);
                    setEditingNoteId(id);
                    setNoteText(org.latestCallNotes || '');
                  }}
                  onCancelNote={() => {
                    setEditingNoteId(null);
                    setNoteText('');
                  }}
                  onNoteChange={setNoteText}
                  onSaveNote={() => handleSaveNote(org)}
                  editingOrgId={editingOrgId}
                  editFields={editFields}
                  savingOrg={savingOrg}
                  onEditOrg={(id) => {
                    setEditingNoteId(null);
                    setNoteText('');
                    setEditingOrgId(id);
                    setEditFields({
                      name: org.name || '',
                      chairmanName: org.chairmanName || '',
                      chairmanPhone: org.chairmanPhone || '',
                      chairmanEmail: org.chairmanEmail || '',
                    });
                  }}
                  onCancelEditOrg={() => setEditingOrgId(null)}
                  onEditFieldChange={(field, value) => setEditFields((prev) => ({ ...prev, [field]: value }))}
                  onSaveOrg={() => handleSaveOrgFields(org)}
                  onCall={(org) => {
                    if (org.chairmanPhone) {
                      window.open(`tel:${org.chairmanPhone}`, '_blank');
                    } else {
                      toast.error('Ingen telefonnummer registrert');
                    }
                  }}
                  onSms={() => openSmsModal(org)}
                  onEmail={() => openEmailModal(org)}
                  onCallback={() => {
                    setModalOrg(org);
                    setCallbackDay('');
                    setCallbackTime('');
                    setCallbackMethod('ring');
                    setCallbackEmailSubject('');
                    setCallbackEmailBody('');
                    setShowCallbackPicker(true);
                  }}
                  onMarkVideresendt={() => handleMarkVideresendt(org)}
                  onAssignFeltselger={(fsId) => handleAssignFeltselger(org, fsId)}
                  onBookMeeting={() => handleOpenBookMeeting(org)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-2xl">
              {searchQuery ? '\u{1F50D}' : activeStage?.emoji}
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">
              {searchQuery ? 'Ingen treff' : 'Tomt her'}
            </p>
            <p className="text-xs text-gray-300">
              {searchQuery ? 'Prøv et annet søkeord' : 'Ingen borettslag i dette steget ennå'}
            </p>
          </div>
        )}
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
                        setCallbackEmailSubject(tpl.getSubject(modalOrg?.name || ''));
                        setCallbackEmailBody(tpl.getBody(modalOrg?.name || ''));
                      }}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-xl border transition-colors',
                        callbackEmailSubject === tpl.getSubject(modalOrg?.name || '')
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
            <select
              value={bookSelectedFeltselger}
              onChange={(e) => setBookSelectedFeltselger(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Velg feltselger</option>
              {feltselgere.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          {bookSelectedFeltselger ? (
            <AvailableSlotPicker
              userId={bookSelectedFeltselger}
              onSelect={(date, time) => {
                setBookSelectedDate(new Date(date + 'T12:00:00'));
                setBookSelectedTime(time);
              }}
              selectedDate={bookSelectedDate ? format(bookSelectedDate, 'yyyy-MM-dd') : null}
              selectedTime={bookSelectedTime}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Velg feltselger for å se ledige tider
            </p>
          )}
          <Button
            fullWidth
            onClick={handleBookMeeting}
            isLoading={bookingInProgress}
            disabled={!bookSelectedDate || !bookSelectedTime || !bookSelectedFeltselger}
          >
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
            <p className="text-sm text-gray-700">
              {modalOrg?.chairmanName} ({modalOrg?.chairmanPhone || 'Ingen nummer'})
            </p>
          </div>
          {smsTemplates.length > 0 && (
            <div>
              <label className="label">Velg mal</label>
              <div className="flex flex-wrap gap-2">
                {smsTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => modalOrg && setSmsText(replaceVariables(t.body, modalOrg))}
                    className="px-3 py-1.5 text-sm rounded-xl border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">Melding</label>
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={4}
              className="input-field w-full resize-none"
            />
          </div>
          <Button fullWidth onClick={handleSendSms}>
            Send SMS
          </Button>
        </div>
      </Modal>

      {/* ── Email preview modal ── */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title={`Mail-mal — ${modalOrg?.name || ''}`}
      >
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
            <Button fullWidth onClick={handleSendEmail}>
              Åpne i e-post
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Pipeline Card Component ────────────────────────

interface PipelineCardProps {
  org: PipelineOrg;
  stage: typeof PIPELINE_STAGES[number];
  feltselgere: { id: string; name: string }[];
  editingNoteId: string | null;
  noteText: string;
  savingNote: boolean;
  onEditNote: (id: string) => void;
  onCancelNote: () => void;
  onNoteChange: (text: string) => void;
  onSaveNote: () => void;
  editingOrgId: string | null;
  editFields: { name: string; chairmanName: string; chairmanPhone: string; chairmanEmail: string };
  savingOrg: boolean;
  onEditOrg: (id: string) => void;
  onCancelEditOrg: () => void;
  onEditFieldChange: (field: string, value: string) => void;
  onSaveOrg: () => void;
  onCall: (org: PipelineOrg) => void;
  onSms: () => void;
  onEmail: () => void;
  onCallback: () => void;
  onMarkVideresendt: () => void;
  onAssignFeltselger: (fsId: string) => void;
  onBookMeeting: () => void;
}

function PipelineCard({
  org,
  stage,
  feltselgere,
  editingNoteId,
  noteText,
  savingNote,
  onEditNote,
  onCancelNote,
  onNoteChange,
  onSaveNote,
  editingOrgId,
  editFields,
  savingOrg,
  onEditOrg,
  onCancelEditOrg,
  onEditFieldChange,
  onSaveOrg,
  onCall,
  onSms,
  onEmail,
  onCallback,
  onMarkVideresendt,
  onAssignFeltselger,
  onBookMeeting,
}: PipelineCardProps) {
  const isEditingNote = editingNoteId === org.id;
  const isEditingOrg = editingOrgId === org.id;

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all active:scale-[0.995]">
      {/* Color top accent */}
      <div className="h-1" style={{ background: stage.color }} />
      <div className="p-4">
        {/* Name + units */}
        <div className="flex items-start justify-between gap-2 mb-1">
          {isEditingOrg ? (
            <input
              type="text"
              value={editFields.name}
              onChange={(e) => onEditFieldChange('name', e.target.value)}
              className="text-[15px] font-semibold text-gray-900 leading-snug bg-white border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-blue-400 flex-1 min-w-0"
              style={{ fontSize: 16 }}
            />
          ) : (
            <h3 className="text-[15px] font-semibold text-gray-900 leading-snug">{org.name}</h3>
          )}
          {org.numUnits && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg flex-shrink-0">
              <Home className="w-3.5 h-3.5 text-gray-400" />
              {org.numUnits}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600">{org.address}</p>
        {org.buildingYear && (
          <p className="text-[11px] text-gray-400 mb-3">Alder bygg: {new Date().getFullYear() - org.buildingYear} år ({org.buildingYear})</p>
        )}
        {!org.buildingYear && <div className="mb-3" />}

        {/* Inline note */}
        <div className="mb-3">
          {isEditingNote ? (
            <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
              <textarea
                rows={2}
                placeholder="Skriv notat..."
                value={noteText}
                onChange={(e) => onNoteChange(e.target.value)}
                className="w-full px-3 py-2 text-[13px] text-gray-700 resize-none outline-none"
                style={{ fontSize: 16 }}
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 px-2 py-1.5 bg-gray-50 border-t border-gray-100">
                <button onClick={onCancelNote} className="text-[11px] text-gray-400 hover:text-gray-600 font-medium px-2 py-1">
                  Avbryt
                </button>
                <button
                  onClick={onSaveNote}
                  disabled={savingNote}
                  className="text-[11px] text-white bg-black hover:bg-gray-800 font-medium px-3 py-1 rounded-md disabled:opacity-50"
                >
                  {savingNote ? 'Lagrer...' : 'Lagre'}
                </button>
              </div>
            </div>
          ) : org.latestCallNotes ? (
            <button
              onClick={() => onEditNote(org.id)}
              className="w-full text-left bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2 hover:bg-amber-100 transition-colors"
            >
              <Pencil className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
              <p className="text-[12px] text-gray-700 flex-1">{org.latestCallNotes}</p>
            </button>
          ) : (
            <button
              onClick={() => onEditNote(org.id)}
              className="w-full flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 py-1.5 px-1 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Legg til notat
            </button>
          )}
        </div>

        {/* Chairman info */}
        {isEditingOrg ? (
          <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-3 mb-3 space-y-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Styreleder</p>
            <input
              type="text"
              placeholder="Navn"
              value={editFields.chairmanName}
              onChange={(e) => onEditFieldChange('chairmanName', e.target.value)}
              className="w-full text-sm bg-white border border-gray-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
              style={{ fontSize: 16 }}
            />
            <input
              type="tel"
              placeholder="Telefon"
              value={editFields.chairmanPhone}
              onChange={(e) => onEditFieldChange('chairmanPhone', e.target.value)}
              className="w-full text-sm bg-white border border-gray-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
              style={{ fontSize: 16 }}
            />
            <input
              type="email"
              placeholder="E-post"
              value={editFields.chairmanEmail}
              onChange={(e) => onEditFieldChange('chairmanEmail', e.target.value)}
              className="w-full text-sm bg-white border border-gray-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
              style={{ fontSize: 16 }}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onCancelEditOrg} className="text-[12px] text-gray-400 hover:text-gray-600 font-medium px-3 py-1.5">
                Avbryt
              </button>
              <button
                onClick={onSaveOrg}
                disabled={savingOrg}
                className="text-[12px] text-white bg-black hover:bg-gray-800 font-medium px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                {savingOrg ? 'Lagrer...' : 'Lagre'}
              </button>
            </div>
          </div>
        ) : org.chairmanName ? (
          <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded-lg px-3 py-2.5 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Styreleder</p>
              <p className="text-sm font-semibold text-gray-900">{org.chairmanName}</p>
              {org.chairmanPhone && (
                <p className="text-xs text-blue-600">
                  <a href={`tel:${org.chairmanPhone}`}>{org.chairmanPhone}</a>
                </p>
              )}
              {org.chairmanEmail && (
                <p className="text-xs text-blue-600 truncate">
                  <a href={`mailto:${org.chairmanEmail}`}>{org.chairmanEmail}</a>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onEditOrg(org.id)}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-500" />
              </button>
              {org.chairmanPhone && (
                <a
                  href={`tel:${org.chairmanPhone}`}
                  className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
                >
                  <Phone className="w-[18px] h-[18px] text-white" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => onEditOrg(org.id)}
            className="w-full flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 py-1.5 px-1 mb-3 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Legg til styreleder
          </button>
        )}

        {/* Feltselger badge (for klar stage) */}
        {org.pipelineStage === 'klar' && org.assignedToId && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
            <Users className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-[9px] uppercase tracking-wider text-green-600 font-semibold">Feltselger</p>
              <p className="text-sm font-medium text-gray-900">
                {feltselgere.find((f) => f.id === org.assignedToId)?.name || 'Tildelt'}
              </p>
            </div>
          </div>
        )}

        {/* Stage-specific actions */}
        <StageActions
          stage={org.pipelineStage}
          org={org}
          feltselgere={feltselgere}
          onCall={onCall}
          onSms={onSms}
          onEmail={onEmail}
          onCallback={onCallback}
          onMarkVideresendt={onMarkVideresendt}
          onAssignFeltselger={onAssignFeltselger}
          onBookMeeting={onBookMeeting}
        />
      </div>
    </div>
  );
}

// ─── Stage-specific action buttons ──────────────────

interface StageActionsProps {
  stage: string;
  org: PipelineOrg;
  feltselgere: { id: string; name: string }[];
  onCall: (org: PipelineOrg) => void;
  onSms: () => void;
  onEmail: () => void;
  onCallback: () => void;
  onMarkVideresendt: () => void;
  onAssignFeltselger: (fsId: string) => void;
  onBookMeeting: () => void;
}

function StageActions({
  stage,
  org,
  feltselgere,
  onCall,
  onSms,
  onEmail,
  onCallback,
  onMarkVideresendt,
  onAssignFeltselger,
  onBookMeeting,
}: StageActionsProps) {
  const primaryBtn = 'w-full flex items-center justify-center gap-2 bg-black text-white rounded-xl hover:bg-gray-800 font-medium text-sm py-3 px-4 active:scale-[0.97] transition-all';
  const secondaryBtn = 'w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm py-2.5 px-3 active:scale-[0.97] transition-all';
  const boldBtn = 'w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl hover:bg-black font-bold text-sm py-3 px-4 active:scale-[0.97] transition-all';

  switch (stage) {
    case 'ikke_ringt':
      return (
        <div className="space-y-2">
          <button onClick={() => onCall(org)} className={primaryBtn}>
            <Phone className="w-4 h-4" />Ring
          </button>
          <div className="flex gap-2">
            <button onClick={onEmail} className={cn(secondaryBtn, 'flex-1')}>
              <Mail className="w-4 h-4" />Send mail
            </button>
            <button onClick={onCallback} className={cn(secondaryBtn, 'flex-1')}>
              <Clock className="w-4 h-4" />Callback
            </button>
          </div>
          <button onClick={onSms} className={secondaryBtn}>
            <MessageSquareText className="w-4 h-4" />Send SMS
          </button>
        </div>
      );

    case 'ringt_folg_opp':
      return (
        <div className="space-y-2">
          <button onClick={() => onCall(org)} className={primaryBtn}>
            <Phone className="w-4 h-4" />Ring igjen
          </button>
          <div className="flex gap-2">
            <button onClick={onEmail} className={cn(secondaryBtn, 'flex-1')}>
              <Mail className="w-4 h-4" />Send mail
            </button>
            <button onClick={onCallback} className={cn(secondaryBtn, 'flex-1')}>
              <Clock className="w-4 h-4" />Callback
            </button>
          </div>
          <button onClick={onSms} className={secondaryBtn}>
            <MessageSquareText className="w-4 h-4" />Send SMS
          </button>
        </div>
      );

    case 'venter':
      return (
        <div className="space-y-2">
          <button onClick={() => onCall(org)} className={primaryBtn}>
            <Phone className="w-4 h-4" />Ring for å sjekke
          </button>
          <div className="flex gap-2">
            <button onClick={onMarkVideresendt} className={cn(secondaryBtn, 'flex-1')}>
              <CheckCircle2 className="w-4 h-4" />Merk videresendt
            </button>
            <button onClick={onEmail} className={cn(secondaryBtn, 'flex-1')}>
              <Eye className="w-4 h-4" />Vis mal
            </button>
          </div>
        </div>
      );

    case 'videresendt':
      return (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
            Fordel til feltselger
          </p>
          <div className="flex flex-col gap-2">
            {feltselgere.map((fs) => (
              <button
                key={fs.id}
                onClick={() => onAssignFeltselger(fs.id)}
                className={secondaryBtn}
              >
                <Users className="w-4 h-4" />
                {fs.name}
              </button>
            ))}
          </div>
        </div>
      );

    case 'klar':
      return (
        <button onClick={onBookMeeting} className={boldBtn}>
          <Calendar className="w-4 h-4" />Book møte
        </button>
      );

    default:
      return null;
  }
}
