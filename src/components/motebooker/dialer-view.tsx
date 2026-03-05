'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, MessageSquare, Mail, FileText, Copy, Car, ChevronLeft, ChevronRight, CalendarDays, UserPlus } from 'lucide-react';
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
  distanceFromOfficeKm: number | null;
  distanceFromOfficeMin: number | null;
  notes: string | null;
}

interface DialerViewProps {
  organizations: Organization[];
  feltselgere: { id: string; name: string }[];
  stats: { ringt: number; naadd: number; booket: number; ikkeSvar: number };
  onCallLogged: () => void;
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

export default function DialerView({ organizations, feltselgere, stats, onCallLogged }: DialerViewProps) {
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

  // Notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<{ id: string; notes: string; createdAt: string }[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // Callback
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');

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
    if (!callbackDate) return;
    setLoggingResult(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, result: 'ring_tilbake', callbackAt: callbackDate }),
      });
      if (!res.ok) throw new Error();
      toast.success('Ring tilbake registrert');
      setShowCallbackPicker(false);
      setCallbackDate('');
      onCallLogged();
      if (currentIndex < organizations.length - 1) setCurrentIndex((i) => i + 1);
    } catch {
      toast.error('Kunne ikke logge resultat');
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
      const scheduledAt = `${dateStr}T${bookSelectedTime}:00`;
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
    setSmsText(`Hei, dette er fra Konvoi. Vi kontakter deg angående ventilasjonsrens for ${org.name}. Vennligst ta kontakt for å avtale tidspunkt.`);
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
    setEmailSubject(`Ventilasjonsrens - ${org.name}`);
    setEmailBody(`Hei,\n\nVi tar kontakt angående ventilasjonsrens for ${org.name} (${org.address}).\n\nVi tilbyr profesjonell ventilasjonsrens og ønsker å avtale et tidspunkt for befaring.\n\nVennlig hilsen\nKonvoi`);
    setShowEmailModal(true);
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
        <div className="mb-2">
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

        {/* Notes */}
        {org.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-xs font-medium text-amber-700 uppercase mb-0.5">Notat</p>
            <p className="text-sm text-amber-900">{org.notes}</p>
          </div>
        )}

        {/* Chairman */}
        {org.chairmanName && (
          <div className="border border-gray-100 rounded-xl px-3 py-2.5 space-y-1.5 mb-3">
            <div>
              <span className="text-[10px] text-gray-400 uppercase">Styreleder</span>
              <p className="text-sm font-semibold leading-tight">{org.chairmanName}</p>
            </div>
            {org.chairmanPhone && (
              <div className="flex items-center justify-between">
                <a href={`tel:${org.chairmanPhone}`} className="flex items-center gap-1.5 text-sm text-blue-600">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhone(org.chairmanPhone)}
                </a>
                <button onClick={() => copyToClipboard(org.chairmanPhone!)} className="p-1 rounded-lg hover:bg-gray-100">
                  <Copy className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>
            )}
            {org.chairmanEmail && (
              <div className="flex items-center justify-between">
                <a href={`mailto:${org.chairmanEmail}`} className="flex items-center gap-1.5 text-sm text-blue-600">
                  <Mail className="h-3.5 w-3.5" />
                  {org.chairmanEmail}
                </a>
                <button onClick={() => copyToClipboard(org.chairmanEmail!)} className="p-1 rounded-lg hover:bg-gray-100">
                  <Copy className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ring button + save contact */}
        {org.chairmanPhone && (
          <div className="flex gap-2 mb-3">
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors"
            >
              <Phone className="h-4 w-4" />
              Ring {org.chairmanName?.split(' ')[0] || 'Styreleder'}
            </a>
            <button
              onClick={() => {
                if (org.chairmanName) {
                  saveContact({
                    name: org.chairmanName,
                    phone: org.chairmanPhone,
                    email: org.chairmanEmail,
                    organization: org.name,
                    address: org.address,
                  });
                  toast.success('Kontakt lastet ned');
                }
              }}
              className="flex items-center justify-center w-11 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              title="Lagre kontakt"
            >
              <UserPlus className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        )}

        {/* Quick actions + Book meeting */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <button onClick={openSmsModal} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <MessageSquare className="h-4 w-4 text-gray-600" />
            <span className="text-[10px] text-gray-600">SMS</span>
          </button>
          <button onClick={openEmailModal} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <Mail className="h-4 w-4 text-gray-600" />
            <span className="text-[10px] text-gray-600">E-post</span>
          </button>
          <button onClick={openNotesModal} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <FileText className="h-4 w-4 text-gray-600" />
            <span className="text-[10px] text-gray-600">Notater</span>
          </button>
          <button onClick={openBookMeeting} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <CalendarDays className="h-4 w-4 text-gray-600" />
            <span className="text-[10px] text-gray-600">Book møte</span>
          </button>
        </div>
      </div>

      {/* ── Bottom action bar with emojis ── */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-2 py-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {[
            { result: 'ikke_svar', emoji: '❄️', label: 'Ingen svar' },
            { result: 'ring_tilbake', emoji: '📞', label: 'Callback' },
            { result: 'mote_booket', emoji: '✅', label: 'Fullført' },
            { result: 'nei', emoji: '🚫', label: 'Nei' },
          ].map((btn) => (
            <button
              key={btn.result}
              onClick={() => handleLogResult(btn.result)}
              disabled={loggingResult}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 active:scale-90 transition-all disabled:opacity-50"
            >
              <span className="text-2xl">{btn.emoji}</span>
              <span className="text-[10px] text-gray-500 font-medium">{btn.label}</span>
            </button>
          ))}
        </div>
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
              <button key={opt.label} onClick={() => setCallbackDate(opt.getValue())}
                className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                  callbackDate === opt.getValue() ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300')}>
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">eller velg fra kalender</p>
          <input type="datetime-local" value={callbackDate ? callbackDate.slice(0, 16) : ''}
            onChange={(e) => setCallbackDate(new Date(e.target.value).toISOString())} className="input-field w-full" />
          <Button fullWidth onClick={handleLogCallback} isLoading={loggingResult} disabled={!callbackDate}>Lagre callback</Button>
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

      {/* ── Email modal ── */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title="Send e-post">
        <div className="space-y-4">
          <div>
            <label className="label">Til</label>
            <p className="text-sm text-gray-700">{org.chairmanEmail || 'Ingen e-post'}</p>
          </div>
          <div>
            <label className="label">Emne</label>
            <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="label">Melding</label>
            <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={6} className="input-field w-full resize-none" />
          </div>
          <Button fullWidth onClick={handleSendEmail}>Send e-post</Button>
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
