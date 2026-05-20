'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import ToggleTabs from '@/components/ui/toggle-tabs';
import DialerView from '@/components/motebooker/dialer-view';
import OrgBottomSheet from '@/components/motebooker/org-bottom-sheet';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { PlusCircle, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES, computePipelineStage } from '@/lib/pipeline';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

const MapView = dynamic(() => import('@/components/motebooker/map-view'), { ssr: false });

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
  distanceFromOfficeKm: number | null;
  distanceFromOfficeMin: number | null;
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


export default function KartPage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const [view, setView] = useState('kart');
  const [activeStep, setActiveStep] = useState('ikke_ringt');
  const [organizations, setOrganizations] = useState<PipelineOrg[]>([]);
  const [feltselgere, setFeltselgere] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<PipelineOrg | null>(null);
  const [stats, setStats] = useState({ ringt: 0, naadd: 0, booket: 0, ikkeSvar: 0 });
  const [orgMarkerTypes, setOrgMarkerTypes] = useState<Record<string, string>>({});

  // Modal states
  const [showBookMeeting, setShowBookMeeting] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);

  // Work order states
  const [teknikere, setTeknikere] = useState<{ id: string; name: string }[]>([]);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [woSelectedTechnician, setWoSelectedTechnician] = useState('');
  const [woSelectedDate, setWoSelectedDate] = useState<Date | null>(null);
  const [woSelectedTime, setWoSelectedTime] = useState<string | null>(null);
  const [woNotes, setWoNotes] = useState('');
  const [woCreating, setWoCreating] = useState(false);

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

  // Inline notes state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Inline org edit state
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ name: '', address: '', chairmanName: '', chairmanPhone: '', chairmanEmail: '' });
  const [savingOrg, setSavingOrg] = useState(false);

  // Callback state
  const [callbackDay, setCallbackDay] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackMethod, setCallbackMethod] = useState<'ring' | 'mail'>('ring');
  const [callbackEmailSubject, setCallbackEmailSubject] = useState('');
  const [callbackEmailBody, setCallbackEmailBody] = useState('');

  const [loggingResult, setLoggingResult] = useState(false);

  // Missing geo state
  const [showMissingGeo, setShowMissingGeo] = useState(false);

  // Delete org state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Manual address state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualPostal, setManualPostal] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualNumUnits, setManualNumUnits] = useState('');
  const [manualBuildingYear, setManualBuildingYear] = useState('');
  const [manualChairmanName, setManualChairmanName] = useState('');
  const [manualChairmanPhone, setManualChairmanPhone] = useState('');
  const [manualChairmanEmail, setManualChairmanEmail] = useState('');
  const [manualChairmanBirthNumber, setManualChairmanBirthNumber] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);

  // Swipe gesture for pipeline steps
  const touchStartX = useRef(0);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [orgRes, callRes, userRes, techRes] = await Promise.all([
        fetch(`/api/organizations?limit=500&assignedTo=${userId}`),
        fetch('/api/calls'),
        fetch('/api/users?role=FELTSELGER'),
        fetch('/api/users?role=TEKNIKER'),
      ]);
      const orgData = await orgRes.json();
      const callData = await callRes.json();
      const userData = await userRes.json();
      const techData = await techRes.json();

      setFeltselgere((userData.users || []).map((u: any) => ({ id: u.id, name: u.name })));
      setTeknikere((techData.users || []).map((u: any) => ({ id: u.id, name: u.name })));

      const orgs: Organization[] = orgData.organizations || [];
      const calls: CallRecord[] = callData.calls || [];

      // Stats
      setStats({
        ringt: calls.length,
        naadd: calls.filter((c: any) => c.result !== 'ikke_svar').length,
        booket: calls.filter((c: any) => c.result === 'mote_booket').length,
        ikkeSvar: calls.filter((c: any) => c.result === 'ikke_svar').length,
      });

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

      // Build marker types for map (pipeline stage per org)
      const markers: Record<string, string> = {};
      for (const org of pipelineOrgs) {
        markers[org.id] = org.pipelineStage;
      }
      setOrgMarkerTypes(markers);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Swipe gestures for mobile (step navigation)
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

  const activeIdx = PIPELINE_STAGES.findIndex((s) => s.key === activeStep);
  const activeStage = PIPELINE_STAGES[activeIdx];

  // Filter orgs for map by active pipeline step
  const mapOrgs = organizations.filter((o) => o.pipelineStage === activeStep);

  const handleSelectOrg = (org: any) => {
    setSelectedOrg(org);
    // Reset editing states
    setEditingOrgId(null);
    setEditingNoteId(null);
    setNoteText('');
  };

  const handleClosePanel = () => {
    setSelectedOrg(null);
    setEditingOrgId(null);
    setEditingNoteId(null);
    setNoteText('');
  };

  // ── Log result ──
  const handleLogResult = async (org: PipelineOrg, result: string) => {
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

      const resultLabels: Record<string, string> = {
        mote_booket: 'Fullført',
        ikke_svar: 'Ingen svar',
        mail_sendt: 'Mail sendt',
        nei: 'Nei',
        videresendt: 'Videresendt',
      };
      toast.success(resultLabels[result] || 'Logget');
      setSelectedOrg(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke logge resultat');
    } finally {
      setLoggingResult(false);
    }
  };

  const handleLogCallback = async () => {
    if (!selectedOrg || !callbackDay || !callbackTime) return;
    setLoggingResult(true);
    try {
      const callbackAt = new Date(`${callbackDay}T${callbackTime}:00`).toISOString();

      if (callbackMethod === 'mail' && callbackEmailBody) {
        if (selectedOrg.chairmanEmail) {
          const subject = encodeURIComponent(callbackEmailSubject);
          const body = encodeURIComponent(callbackEmailBody);
          window.open(`mailto:${selectedOrg.chairmanEmail}?subject=${subject}&body=${body}`, '_blank');
        }
        const res = await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: selectedOrg.id,
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
          body: JSON.stringify({
            organizationId: selectedOrg.id,
            result: 'ring_tilbake',
            callbackAt,
          }),
        });
        if (!res.ok) throw new Error();
      }

      toast.success(callbackMethod === 'mail' ? 'E-post åpnet og oppfølging lagret' : 'Oppfølging lagret');
      setShowCallbackPicker(false);
      setSelectedOrg(null);
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
  const handleBookMeeting = async () => {
    if (!selectedOrg || !bookSelectedDate || !bookSelectedTime || !bookSelectedFeltselger) {
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
          organizationId: selectedOrg.id,
          userId: bookSelectedFeltselger,
          scheduledAt,
        }),
      });
      if (!res.ok) throw new Error();

      // Also log call result
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrg.id, result: 'mote_booket' }),
      });

      toast.success('Møte booket!');
      setShowBookMeeting(false);
      setSelectedOrg(null);
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
      .replace(/\{\{selger\}\}/g, userName)
      .replace(/\{\{dato\}\}/g, '')
      .replace(/\{\{tidspunkt\}\}/g, '');
  };

  const openSmsModal = async () => {
    if (selectedOrg) {
      setSmsText(
        `Hei, Jonas fra Turbo som prøvde å ringe. Ringte angående "${selectedOrg.name}". Gjelder ventilasjonsrens. Ring meg gjerne opp når du har mulighet.`
      );
    }
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
    if (!selectedOrg?.chairmanPhone) {
      toast.error('Ingen telefonnummer registrert');
      return;
    }
    const encoded = encodeURIComponent(smsText);
    window.open(`sms:${selectedOrg.chairmanPhone}?body=${encoded}`, '_blank');
    toast.success('SMS åpnet');
    setShowSmsModal(false);
  };

  // ── Email ──
  const openEmailModal = () => {
    if (selectedOrg) {
      setEmailSubject(`Ventilasjonsrens — ${selectedOrg.name}`);
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
    }
    setEmailCopied(false);
    setShowEmailModal(true);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Emne: ${emailSubject}\n\n${emailBody}`);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1500);
  };

  const handleSendEmail = async () => {
    if (!selectedOrg?.chairmanEmail) {
      toast.error('Ingen e-post registrert');
      return;
    }
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.open(`mailto:${selectedOrg.chairmanEmail}?subject=${subject}&body=${body}`, '_blank');
    setShowEmailModal(false);
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrg.id, result: 'mail_sendt' }),
      });
      toast.success('Mail sendt registrert');
      fetchData();
    } catch {
      toast.success('E-post åpnet');
    }
  };

  // ── Inline notes ──
  const handleSaveInlineNote = async () => {
    if (!selectedOrg || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          result: selectedOrg.latestCallResult || 'ring_tilbake',
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
  const handleSaveOrgFields = async () => {
    if (!selectedOrg) return;
    setSavingOrg(true);
    try {
      const diff: Record<string, string> = {};
      if (editFields.name.trim() !== (selectedOrg.name || '')) diff.name = editFields.name.trim();
      if (editFields.chairmanName.trim() !== (selectedOrg.chairmanName || '')) diff.chairmanName = editFields.chairmanName.trim();
      if (editFields.chairmanPhone.trim() !== (selectedOrg.chairmanPhone || '')) diff.chairmanPhone = editFields.chairmanPhone.trim();
      if (editFields.chairmanEmail.trim() !== (selectedOrg.chairmanEmail || '')) diff.chairmanEmail = editFields.chairmanEmail.trim();

      const addressChanged = editFields.address.trim() !== (selectedOrg.address || '');
      if (addressChanged) diff.address = editFields.address.trim();

      if (Object.keys(diff).length === 0) {
        setEditingOrgId(null);
        return;
      }

      const res = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      });
      if (!res.ok) throw new Error();

      // Re-geocode if address changed
      if (addressChanged) {
        toast('Geokoder ny adresse...', { icon: '📍' });
        await fetch(`/api/organizations/${selectedOrg.id}/geocode`, { method: 'POST' });
      }

      toast.success('Oppdatert');
      setEditingOrgId(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke lagre endringer');
    } finally {
      setSavingOrg(false);
    }
  };

  // ── Assign feltselger ──
  const handleAssignFeltselger = async (fsId: string) => {
    if (!selectedOrg) return;
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: fsId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Feltselger tildelt');
      setSelectedOrg(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke tildele feltselger');
    }
  };

  // ── Mark as videresendt ──
  const handleMarkVideresendt = async () => {
    if (!selectedOrg) return;
    await handleLogResult(selectedOrg, 'videresendt');
  };

  // ── Open modals from bottom sheet ──
  const handleOpenBookMeeting = () => {
    setBookSelectedDate(null);
    setBookSelectedTime(null);
    setBookSelectedFeltselger(feltselgere[0]?.id || '');
    setShowBookMeeting(true);
  };

  // ── Create work order ──
  const handleOpenCreateWorkOrder = () => {
    const userRoles: string[] = (session?.user as any)?.roles || [];
    const isTechnician = userRoles.includes('TEKNIKER');
    setWoSelectedTechnician(isTechnician ? userId : teknikere[0]?.id || '');
    setWoSelectedDate(null);
    setWoSelectedTime(null);
    setWoNotes('');
    setShowCreateWorkOrder(true);
  };

  const handleDeleteOrg = async () => {
    if (!selectedOrg) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Adresse fjernet');
      setShowDeleteConfirm(false);
      setSelectedOrg(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke fjerne adresse');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateWorkOrder = async () => {
    if (!selectedOrg || !woSelectedTechnician || !woSelectedDate || !woSelectedTime) {
      toast.error('Velg tekniker, dato og tid');
      return;
    }

    setWoCreating(true);
    try {
      const dateStr = format(woSelectedDate, 'yyyy-MM-dd');
      const scheduledAt = new Date(`${dateStr}T${woSelectedTime}`).toISOString();

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          technicianId: woSelectedTechnician,
          scheduledAt,
          notes: woNotes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();

      toast.success('Oppdrag opprettet!');
      setShowCreateWorkOrder(false);
      setSelectedOrg(null);
      fetchData();
    } catch {
      toast.error('Kunne ikke opprette oppdrag');
    } finally {
      setWoCreating(false);
    }
  };

  // ── Add manual address ──
  const handleAddAddress = async () => {
    if (!manualAddress.trim()) {
      toast.error('Skriv inn en adresse');
      return;
    }
    setAddingAddress(true);
    try {
      const fullAddress = [manualAddress.trim(), manualPostal.trim(), manualCity.trim()].filter(Boolean).join(', ');
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName.trim() || manualChairmanName.trim() || fullAddress,
          address: manualAddress.trim(),
          postalCode: manualPostal.trim() || undefined,
          city: manualCity.trim() || undefined,
          numUnits: manualNumUnits ? parseInt(manualNumUnits, 10) : 1,
          buildingYear: manualBuildingYear ? parseInt(manualBuildingYear, 10) : undefined,
          chairmanName: manualChairmanName.trim() || undefined,
          chairmanPhone: manualChairmanPhone.trim() || undefined,
          chairmanEmail: manualChairmanEmail.trim() || undefined,
          chairmanBirthNumber: manualChairmanBirthNumber.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();

      const data = await res.json();
      if (data.organization?.id) {
        const updateData: any = {};
        if (userId) updateData.assignedToId = userId;
        if (manualNote.trim()) updateData.notes = manualNote.trim();
        if (Object.keys(updateData).length > 0) {
          await fetch(`/api/organizations/${data.organization.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          });
        }
      }

      if (data.organization && (data.organization.latitude == null || data.organization.longitude == null)) {
        toast('Adresse lagt til, men kunne ikke finne koordinater. Adressen vises ikke på kartet.', { icon: '⚠️', duration: 5000 });
      } else {
        toast.success('Adresse lagt til');
      }
      setShowAddAddress(false);
      setManualName('');
      setManualAddress('');
      setManualPostal('');
      setManualCity('');
      setManualNumUnits('');
      setManualBuildingYear('');
      setManualChairmanName('');
      setManualChairmanPhone('');
      setManualChairmanEmail('');
      setManualChairmanBirthNumber('');
      setManualNote('');
      fetchData();
    } catch {
      toast.error('Kunne ikke legge til adresse');
    } finally {
      setAddingAddress(false);
    }
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
      {/* Header */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowAddAddress(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Legg til
          </button>
          <ToggleTabs
            tabs={[
              { id: 'kart', label: 'Kart' },
              { id: 'dialer', label: 'Dialer' },
            ]}
            activeTab={view}
            onChange={setView}
          />
        </div>
      </div>

      {/* Pipeline stepper bar */}
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

      {/* Addresses without coordinates warning + fix */}
      {view === 'kart' && organizations.some((o) => !o.latitude || !o.longitude) && (
        <div className="px-4 pb-2 space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-amber-700">
              {organizations.filter((o) => !o.latitude || !o.longitude).length} adresse(r) mangler koordinater
            </span>
            <button
              onClick={() => setShowMissingGeo((v) => !v)}
              className="text-xs font-medium text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg hover:bg-amber-200 transition-colors"
            >
              {showMissingGeo ? 'Skjul' : 'Vis / fiks'}
            </button>
          </div>
          {showMissingGeo && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {organizations.filter((o) => !o.latitude || !o.longitude).map((org) => (
                <div key={org.id} className="bg-white border border-amber-200 rounded-xl px-3 py-2.5 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                  <p className="text-xs text-gray-500">{org.address}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Skriv riktig adresse..."
                      defaultValue={org.address}
                      id={`fix-addr-${org.id}`}
                      className="flex-1 text-sm bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
                      style={{ fontSize: 16 }}
                    />
                    <button
                      onClick={async () => {
                        const input = document.getElementById(`fix-addr-${org.id}`) as HTMLInputElement;
                        const newAddr = input?.value?.trim();
                        if (!newAddr) { toast.error('Skriv inn en adresse'); return; }
                        toast('Lagrer og geokoder...', { icon: '📍' });
                        try {
                          await fetch(`/api/organizations/${org.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ address: newAddr }),
                          });
                          await fetch(`/api/organizations/${org.id}/geocode`, { method: 'POST' });
                          toast.success('Adresse oppdatert og geokodet');
                          fetchData();
                        } catch {
                          toast.error('Kunne ikke geokode adressen');
                        }
                      }}
                      className="px-3 py-2 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
                    >
                      Lagre
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Slette ${org.name}?`)) return;
                        try {
                          await fetch(`/api/organizations/${org.id}`, { method: 'DELETE' });
                          toast.success('Adresse slettet');
                          fetchData();
                        } catch {
                          toast.error('Kunne ikke slette');
                        }
                      }}
                      className="px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors flex-shrink-0"
                    >
                      Slett
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        {view === 'kart' ? (
          <MapView
            organizations={mapOrgs}
            statusFilter="alle"
            onSelectOrg={(org: any) => handleSelectOrg(org)}
            orgMarkerTypes={orgMarkerTypes}
          />
        ) : (
          <DialerView
            organizations={mapOrgs}
            feltselgere={feltselgere}
            stats={stats}
            onCallLogged={fetchData}
            onSelectOrg={(org: any) => handleSelectOrg(org)}
          />
        )}

        {/* Bottom sheet */}
        {selectedOrg && activeStage && (
          <OrgBottomSheet
            org={selectedOrg}
            stage={activeStage}
            feltselgere={feltselgere}
            editingOrgId={editingOrgId}
            editFields={editFields}
            savingOrg={savingOrg}
            onEditOrg={(id) => {
              setEditingNoteId(null);
              setNoteText('');
              setEditingOrgId(id);
              setEditFields({
                name: selectedOrg.name || '',
                address: selectedOrg.address || '',
                chairmanName: selectedOrg.chairmanName || '',
                chairmanPhone: selectedOrg.chairmanPhone || '',
                chairmanEmail: selectedOrg.chairmanEmail || '',
              });
            }}
            onCancelEditOrg={() => setEditingOrgId(null)}
            onEditFieldChange={(field, value) => setEditFields((prev) => ({ ...prev, [field]: value }))}
            onSaveOrg={handleSaveOrgFields}
            editingNoteId={editingNoteId}
            noteText={noteText}
            savingNote={savingNote}
            onEditNote={(id) => {
              setEditingOrgId(null);
              setEditingNoteId(id);
              setNoteText(selectedOrg.latestCallNotes || '');
            }}
            onCancelNote={() => {
              setEditingNoteId(null);
              setNoteText('');
            }}
            onNoteChange={setNoteText}
            onSaveNote={handleSaveInlineNote}
            onCall={() => {
              if (selectedOrg.chairmanPhone) {
                window.open(`tel:${selectedOrg.chairmanPhone}`, '_blank');
              } else {
                toast.error('Ingen telefonnummer registrert');
              }
            }}
            onSms={openSmsModal}
            onEmail={openEmailModal}
            onCallback={() => {
              setCallbackDay('');
              setCallbackTime('');
              setCallbackMethod('ring');
              setCallbackEmailSubject('');
              setCallbackEmailBody('');
              setShowCallbackPicker(true);
            }}
            onMarkVideresendt={handleMarkVideresendt}
            onAssignFeltselger={handleAssignFeltselger}
            onBookMeeting={handleOpenBookMeeting}
            onCreateWorkOrder={handleOpenCreateWorkOrder}
            onDelete={() => setShowDeleteConfirm(true)}
            onClose={handleClosePanel}
            loggingResult={loggingResult}
          />
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
                        setCallbackEmailSubject(tpl.getSubject(selectedOrg?.name || ''));
                        setCallbackEmailBody(tpl.getBody(selectedOrg?.name || ''));
                      }}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-xl border transition-colors',
                        callbackEmailSubject === tpl.getSubject(selectedOrg?.name || '')
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
          {/* Feltselger dropdown */}
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

          {/* Availability-based date/time picker */}
          {bookSelectedFeltselger && (
            <AvailableSlotPicker
              userId={bookSelectedFeltselger}
              onSelect={(date, time) => {
                setBookSelectedDate(new Date(date + 'T12:00:00'));
                setBookSelectedTime(time);
              }}
              selectedDate={bookSelectedDate ? format(bookSelectedDate, 'yyyy-MM-dd') : null}
              selectedTime={bookSelectedTime}
            />
          )}
          {!bookSelectedFeltselger && (
            <p className="text-sm text-gray-400 text-center py-4">
              Velg feltselger for å se ledige tider
            </p>
          )}

          {/* Confirm */}
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
            <p className="text-sm text-gray-700">{selectedOrg?.chairmanName} ({selectedOrg?.chairmanPhone || 'Ingen nummer'})</p>
          </div>
          {smsTemplates.length > 0 && (
            <div>
              <label className="label">Velg mal</label>
              <div className="flex flex-wrap gap-2">
                {smsTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectedOrg && setSmsText(replaceVariables(t.body, selectedOrg))}
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
              style={{ fontSize: 16 }}
            />
          </div>
          <Button fullWidth onClick={handleSendSms}>
            Send SMS
          </Button>
        </div>
      </Modal>

      {/* ── Email preview modal ── */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title={`Mail-mal — ${selectedOrg?.name || ''}`}>
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">Emne</p>
            <p className="text-sm font-medium text-gray-800">{emailSubject}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-3 max-h-72 overflow-y-auto">
            <p className="text-sm text-gray-800 whitespace-pre-line">{emailBody}</p>
          </div>
          <div className="flex gap-3">
            <Button
              fullWidth
              variant="secondary"
              onClick={handleCopyEmail}
            >
              {emailCopied ? 'Kopiert!' : 'Kopier tekst'}
            </Button>
            <Button fullWidth onClick={handleSendEmail}>
              Åpne i e-post
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add address modal ── */}
      <Modal isOpen={showAddAddress} onClose={() => setShowAddAddress(false)} title="Legg til sameie manuelt">
        <div className="space-y-3">
          <Input
            label="Navn på sameie"
            placeholder="F.eks. Gydas gate 16 Sameie"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
          <Input
            label="Adresse *"
            placeholder="F.eks. Gydas gate 16"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Postnummer"
              placeholder="3732"
              value={manualPostal}
              onChange={(e) => setManualPostal(e.target.value)}
            />
            <Input
              label="Sted"
              placeholder="Skien"
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Antall enheter"
              type="number"
              placeholder="F.eks. 24"
              value={manualNumUnits}
              onChange={(e) => setManualNumUnits(e.target.value)}
            />
            <Input
              label="Byggeår"
              type="number"
              placeholder="F.eks. 1985"
              value={manualBuildingYear}
              onChange={(e) => setManualBuildingYear(e.target.value)}
            />
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Styreleder / kontaktperson</p>
            <div className="space-y-3">
              <Input
                label="Navn"
                placeholder="Ola Nordmann"
                value={manualChairmanName}
                onChange={(e) => setManualChairmanName(e.target.value)}
              />
              <Input
                label="Fødselsår"
                type="number"
                placeholder="F.eks. 1947"
                value={manualChairmanBirthNumber}
                onChange={(e) => setManualChairmanBirthNumber(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Telefon"
                  type="tel"
                  placeholder="900 00 000"
                  value={manualChairmanPhone}
                  onChange={(e) => setManualChairmanPhone(e.target.value)}
                />
                <Input
                  label="E-post"
                  type="email"
                  placeholder="ola@example.no"
                  value={manualChairmanEmail}
                  onChange={(e) => setManualChairmanEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Notat</label>
            <textarea
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              rows={2}
              placeholder="F.eks. gammel ventilasjon, snakket med på døra..."
              className="input-field w-full resize-none"
              style={{ fontSize: 16 }}
            />
          </div>
          <Button
            fullWidth
            onClick={handleAddAddress}
            isLoading={addingAddress}
            disabled={!manualAddress.trim()}
          >
            Legg til adresse
          </Button>
        </div>
      </Modal>

      {/* ── Create work order modal ── */}
      <Modal isOpen={showCreateWorkOrder} onClose={() => setShowCreateWorkOrder(false)} title="Opprett oppdrag" size="lg">
        <div className="space-y-5">
          {/* Technician dropdown */}
          <div>
            <label className="label">Tekniker</label>
            <select
              value={woSelectedTechnician}
              onChange={(e) => setWoSelectedTechnician(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Velg tekniker</option>
              {teknikere.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.id === userId ? ' (meg)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Availability-based date/time picker */}
          {woSelectedTechnician && (
            <AvailableSlotPicker
              userId={woSelectedTechnician}
              onSelect={(date, time) => {
                setWoSelectedDate(new Date(date + 'T12:00:00'));
                setWoSelectedTime(time);
              }}
              selectedDate={woSelectedDate ? format(woSelectedDate, 'yyyy-MM-dd') : null}
              selectedTime={woSelectedTime}
            />
          )}
          {!woSelectedTechnician && (
            <p className="text-sm text-gray-400 text-center py-4">
              Velg tekniker for å se ledige tider
            </p>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notat (valgfritt)</label>
            <textarea
              value={woNotes}
              onChange={(e) => setWoNotes(e.target.value)}
              rows={2}
              placeholder="F.eks. tilgang via bakdør, ring først..."
              className="input-field w-full resize-none"
              style={{ fontSize: 16 }}
            />
          </div>

          {/* Confirm */}
          <Button
            fullWidth
            onClick={handleCreateWorkOrder}
            isLoading={woCreating}
            disabled={!woSelectedDate || !woSelectedTime || !woSelectedTechnician}
          >
            {woSelectedDate && woSelectedTime
              ? `Opprett oppdrag ${format(woSelectedDate, 'EEEE d. MMMM', { locale: nb })} kl ${woSelectedTime}`
              : 'Velg dato og tid'}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Fjerne adresse?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil fjerne <span className="font-semibold">{selectedOrg?.name}</span> fra kartet? All historikk knyttet til denne adressen vil bli slettet.
          </p>
          <div className="flex gap-3">
            <Button fullWidth variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Avbryt
            </Button>
            <Button fullWidth variant="danger" onClick={handleDeleteOrg} isLoading={deleting}>
              Fjern
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
