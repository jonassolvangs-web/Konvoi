'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import ToggleTabs from '@/components/ui/toggle-tabs';
import FilterChips from '@/components/ui/filter-chips';
import DialerView from '@/components/motebooker/dialer-view';
import OrgBottomSheet from '@/components/motebooker/org-bottom-sheet';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import AvailableSlotPicker from '@/components/ui/available-slot-picker';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { PlusCircle } from 'lucide-react';
import { cn, orgStatusConfig } from '@/lib/utils';
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


export default function KartPage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const [view, setView] = useState('kart');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [feltselgere, setFeltselgere] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState({ ringt: 0, naadd: 0, booket: 0, ikkeSvar: 0 });
  const [orgMarkerTypes, setOrgMarkerTypes] = useState<Record<string, string>>({});
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

  // Modal states
  const [showBookMeeting, setShowBookMeeting] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);

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

  // Notes state
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<{ id: string; notes: string; createdAt: string; result: string }[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // Callback state
  const [callbackDate, setCallbackDate] = useState('');

  const [loggingResult, setLoggingResult] = useState(false);

  // Manual address state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualPostal, setManualPostal] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualChairmanName, setManualChairmanName] = useState('');
  const [manualChairmanPhone, setManualChairmanPhone] = useState('');
  const [manualChairmanEmail, setManualChairmanEmail] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);

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
      const orgs = orgData.organizations || [];
      setOrganizations(orgs);

      const calls = callData.calls || [];
      setStats({
        ringt: calls.length,
        naadd: calls.filter((c: any) => c.result !== 'ikke_svar').length,
        booket: calls.filter((c: any) => c.result === 'mote_booket').length,
        ikkeSvar: calls.filter((c: any) => c.result === 'ikke_svar').length,
      });

      // Build marker types from latest call per org
      const callResultMap: Record<string, string> = {
        ikke_svar: 'ingen_svar',
        ring_tilbake: 'callback',
        mail_sendt: 'mail_sendt',
        mote_booket: 'mote_booket',
        nei: 'nei',
      };

      const latestCallPerOrg: Record<string, string> = {};
      // calls are ordered desc by createdAt, so first occurrence per org is the latest
      for (const call of calls) {
        if (!latestCallPerOrg[call.organizationId]) {
          latestCallPerOrg[call.organizationId] = callResultMap[call.result] || 'ikke_kontaktet';
        }
      }

      // TODO: track mail_sendt separately if needed
      const markers: Record<string, string> = {};
      const counts: Record<string, number> = {
        ingen_svar: 0,
        callback: 0,
        mail_sendt: 0,
        mote_booket: 0,
        nei: 0,
        ikke_kontaktet: 0,
      };

      for (const org of orgs) {
        // Org status takes priority for later stages
        if (org.status === 'besok_pagaar') { markers[org.id] = 'besok_pagaar'; continue; }
        if (org.status === 'venter_tekniker') { markers[org.id] = 'venter_tekniker'; continue; }
        if (org.status === 'rens_pagaar') { markers[org.id] = 'rens_pagaar'; continue; }
        if (org.status === 'fullfort') { markers[org.id] = 'fullfort'; continue; }

        const markerType = latestCallPerOrg[org.id] || 'ikke_kontaktet';
        markers[org.id] = markerType;
        if (counts[markerType] !== undefined) counts[markerType]++;
      }

      setOrgMarkerTypes(markers);
      setFilterCounts(counts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch notes for selected org
  const fetchNotes = useCallback(async (orgId: string) => {
    try {
      const res = await fetch(`/api/calls?organizationId=${orgId}`);
      const data = await res.json();
      setNotes((data.calls || []).filter((c: any) => c.notes));
    } catch {
      setNotes([]);
    }
  }, []);

  const handleSelectOrg = (org: any) => {
    setSelectedOrg(org);
  };

  const handleClosePanel = () => {
    setSelectedOrg(null);
  };

  // ── Log result ──
  const handleLogResult = async (result: string) => {
    if (!selectedOrg) return;

    if (result === 'ring_tilbake') {
      setShowCallbackPicker(true);
      return;
    }

    setLoggingResult(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrg.id, result }),
      });
      if (!res.ok) throw new Error();

      const resultLabels: Record<string, string> = {
        mote_booket: 'Fullført',
        ikke_svar: 'Ingen svar',
        mail_sendt: 'Mail sendt',
        nei: 'Nei',
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
    if (!selectedOrg || !callbackDate) return;
    setLoggingResult(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          result: 'ring_tilbake',
          callbackAt: callbackDate,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Ring tilbake registrert');
      setShowCallbackPicker(false);
      setSelectedOrg(null);
      setCallbackDate('');
      fetchData();
    } catch {
      toast.error('Kunne ikke logge resultat');
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
      const scheduledAt = `${dateStr}T${bookSelectedTime}:00`;

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
  const replaceVariables = (text: string, org: Organization) => {
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
        `Hei, dette er fra Konvoi. Vi kontakter deg angående ventilasjonsrens for ${selectedOrg.name}. Vennligst ta kontakt for å avtale tidspunkt.`
      );
    }
    // Fetch SMS templates
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
      setEmailSubject(`Ventilasjonsrens - ${selectedOrg.name}`);
      setEmailBody(
        `Hei,\n\nVi tar kontakt angående ventilasjonsrens for ${selectedOrg.name} (${selectedOrg.address}).\n\nVi tilbyr profesjonell ventilasjonsrens og ønsker å avtale et tidspunkt for befaring.\n\nVennlig hilsen\nKonvoi`
      );
    }
    setShowEmailModal(true);
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
    // Auto-log mail_sendt
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

  // ── Notes ──
  const openNotesModal = () => {
    if (selectedOrg) {
      fetchNotes(selectedOrg.id);
    }
    setNoteText('');
    setShowNotesModal(true);
  };

  const handleSaveNote = async () => {
    if (!selectedOrg || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          result: 'ring_tilbake',
          notes: noteText.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Notat lagret');
      setNoteText('');
      fetchNotes(selectedOrg.id);
    } catch {
      toast.error('Kunne ikke lagre notat');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Open modals from bottom sheet ──
  const handleOpenBookMeeting = () => {
    setBookSelectedDate(null);
    setBookSelectedTime(null);
    setBookSelectedFeltselger(feltselgere[0]?.id || '');
    setShowBookMeeting(true);
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
          name: manualChairmanName.trim() || fullAddress,
          address: manualAddress.trim(),
          postalCode: manualPostal.trim() || undefined,
          city: manualCity.trim() || undefined,
          numUnits: 1,
          chairmanName: manualChairmanName.trim() || undefined,
          chairmanPhone: manualChairmanPhone.trim() || undefined,
          chairmanEmail: manualChairmanEmail.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();

      // Assign to current user + save note
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

      toast.success('Adresse lagt til');
      setShowAddAddress(false);
      setManualAddress('');
      setManualPostal('');
      setManualCity('');
      setManualChairmanName('');
      setManualChairmanPhone('');
      setManualChairmanEmail('');
      setManualNote('');
      fetchData();
    } catch {
      toast.error('Kunne ikke legge til adresse');
    } finally {
      setAddingAddress(false);
    }
  };

  const statusChips = [
    { id: 'alle', label: 'Alle' },
    { id: 'ikke_kontaktet', label: 'Nye', count: filterCounts.ikke_kontaktet || 0 },
    { id: 'ingen_svar', label: 'Ingen svar', count: filterCounts.ingen_svar || 0 },
    { id: 'callback', label: 'Callback', count: filterCounts.callback || 0 },
    { id: 'mail_sendt', label: 'Mail sendt', count: filterCounts.mail_sendt || 0 },
    { id: 'mote_booket', label: 'Booket', count: filterCounts.mote_booket || 0 },
  ];

  if (loading) return <LoadingSpinner />;

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
        <FilterChips chips={statusChips} activeChip={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        {view === 'kart' ? (
          <MapView
            organizations={organizations}
            statusFilter={statusFilter}
            onSelectOrg={(org: any) => handleSelectOrg(org)}
            orgMarkerTypes={orgMarkerTypes}
          />
        ) : (
          <DialerView
            organizations={organizations.filter(
              (org) => statusFilter === 'alle' || orgMarkerTypes[org.id] === statusFilter
            )}
            feltselgere={feltselgere}
            stats={stats}
            onCallLogged={fetchData}
          />
        )}

        {/* Bottom sheet */}
        {selectedOrg && (
          <OrgBottomSheet
            org={selectedOrg}
            onClose={handleClosePanel}
            onLogResult={handleLogResult}
            onBookMeeting={handleOpenBookMeeting}
            onSms={openSmsModal}
            onEmail={openEmailModal}
            onNotes={openNotesModal}
            loggingResult={loggingResult}
          />
        )}
      </div>

      {/* ── Callback picker modal ── */}
      <Modal isOpen={showCallbackPicker} onClose={() => setShowCallbackPicker(false)} title="Når skal du ringe tilbake?">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Om 1 time', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d.toISOString(); } },
              { label: 'Om 2 timer', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 2); return d.toISOString(); } },
              { label: 'I morgen 09:00', getValue: () => { const d = addDays(new Date(), 1); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
              { label: 'I morgen 12:00', getValue: () => { const d = addDays(new Date(), 1); d.setHours(12, 0, 0, 0); return d.toISOString(); } },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => { setCallbackDate(opt.getValue()); }}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                  callbackDate === opt.getValue()
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">eller velg fra kalender</p>
          <input
            type="datetime-local"
            value={callbackDate ? callbackDate.slice(0, 16) : ''}
            onChange={(e) => setCallbackDate(new Date(e.target.value).toISOString())}
            className="input-field w-full"
          />
          <Button fullWidth onClick={handleLogCallback} isLoading={loggingResult} disabled={!callbackDate}>
            Lagre callback
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
            />
          </div>
          <Button fullWidth onClick={handleSendSms}>
            Send SMS
          </Button>
        </div>
      </Modal>

      {/* ── Email modal ── */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title="Send e-post">
        <div className="space-y-4">
          <div>
            <label className="label">Til</label>
            <p className="text-sm text-gray-700">{selectedOrg?.chairmanEmail || 'Ingen e-post'}</p>
          </div>
          <div>
            <label className="label">Emne</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="label">Melding</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              className="input-field w-full resize-none"
            />
          </div>
          <Button fullWidth onClick={handleSendEmail}>
            Send e-post
          </Button>
        </div>
      </Modal>

      {/* ── Notes modal ── */}
      <Modal isOpen={showNotesModal} onClose={() => setShowNotesModal(false)} title="Notater">
        <div className="space-y-4">
          {/* Previous notes */}
          {notes.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-sm text-gray-800">{n.notes}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(n.createdAt), 'd. MMM yyyy HH:mm', { locale: nb })}
                  </p>
                </div>
              ))}
            </div>
          )}
          {notes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Ingen notater ennå</p>
          )}

          {/* New note */}
          <div>
            <label className="label">Nytt notat</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Skriv notat..."
              className="input-field w-full resize-none"
            />
          </div>
          <Button fullWidth onClick={handleSaveNote} isLoading={savingNote} disabled={!noteText.trim()}>
            Lagre
          </Button>
        </div>
      </Modal>

      {/* ── Add address modal ── */}
      <Modal isOpen={showAddAddress} onClose={() => setShowAddAddress(false)} title="Legg til adresse manuelt">
        <div className="space-y-3">
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
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Beboer</p>
            <div className="space-y-3">
              <Input
                label="Navn"
                placeholder="Ola Nordmann"
                value={manualChairmanName}
                onChange={(e) => setManualChairmanName(e.target.value)}
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
    </div>
  );
}
