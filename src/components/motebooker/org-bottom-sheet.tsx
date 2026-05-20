'use client';

import { useRef, useState } from 'react';
import { X, Phone, Mail, Copy, Car, UserPlus, Wrench, Trash2, Pencil, Clock, MessageSquareText, CheckCircle2, Eye, Users, Calendar } from 'lucide-react';
import { formatDistance, formatPhone } from '@/lib/utils';
import { saveContact } from '@/lib/vcard';
import type { PipelineStage } from '@/lib/pipeline';
import toast from 'react-hot-toast';

interface PipelineOrg {
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
  pipelineStage: string;
  latestCallResult: string | null;
  latestCallNotes: string | null;
  latestCallDate: string | null;
}

interface OrgBottomSheetProps {
  org: PipelineOrg;
  stage: PipelineStage;
  feltselgere: { id: string; name: string }[];
  // Inline org editing
  editingOrgId: string | null;
  editFields: { name: string; address: string; chairmanName: string; chairmanPhone: string; chairmanEmail: string };
  savingOrg: boolean;
  onEditOrg: (id: string) => void;
  onCancelEditOrg: () => void;
  onEditFieldChange: (field: string, value: string) => void;
  onSaveOrg: () => void;
  // Inline notes
  editingNoteId: string | null;
  noteText: string;
  savingNote: boolean;
  onEditNote: (id: string) => void;
  onCancelNote: () => void;
  onNoteChange: (text: string) => void;
  onSaveNote: () => void;
  // Stage actions
  onCall: () => void;
  onSms: () => void;
  onEmail: () => void;
  onCallback: () => void;
  onMarkVideresendt: () => void;
  onAssignFeltselger: (fsId: string) => void;
  onBookMeeting: () => void;
  onCreateWorkOrder?: () => void;
  onDelete?: () => void;
  onClose: () => void;
  loggingResult?: boolean;
}

export default function OrgBottomSheet({
  org,
  stage,
  feltselgere,
  editingOrgId,
  editFields,
  savingOrg,
  onEditOrg,
  onCancelEditOrg,
  onEditFieldChange,
  onSaveOrg,
  editingNoteId,
  noteText,
  savingNote,
  onEditNote,
  onCancelNote,
  onNoteChange,
  onSaveNote,
  onCall,
  onSms,
  onEmail,
  onCallback,
  onMarkVideresendt,
  onAssignFeltselger,
  onBookMeeting,
  onCreateWorkOrder,
  onDelete,
  onClose,
  loggingResult,
}: OrgBottomSheetProps) {
  const isEditingOrg = editingOrgId === org.id;
  const isEditingNote = editingNoteId === org.id;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert');
  };

  // Swipe down to close
  const touchStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (dragOffset > 80) {
      onClose();
    }
    setDragOffset(0);
  };

  const primaryBtn = 'w-full flex items-center justify-center gap-2 bg-black text-white rounded-xl hover:bg-gray-800 font-medium text-sm py-3 px-4 active:scale-[0.97] transition-all';
  const secondaryBtn = 'w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm py-2.5 px-3 active:scale-[0.97] transition-all';
  const boldBtn = 'w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl hover:bg-black font-bold text-sm py-3 px-4 active:scale-[0.97] transition-all';

  return (
    <div
      className="absolute inset-0 z-[1000] flex flex-col animate-slide-up"
      style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined, transition: dragOffset === 0 ? 'transform 0.2s ease-out' : 'none' }}
    >
      {/* Map peek area - click to close */}
      <div className="h-16 shrink-0" onClick={onClose} />

      {/* Panel */}
      <div className="flex-1 flex flex-col bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
        {/* Stage color accent */}
        <div className="h-1" style={{ background: stage.color }} />

        {/* Drag handle + close */}
        <div
          className="shrink-0 pt-2 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-1" />
          <div className="flex justify-between px-4">
            <button onClick={onClose} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
            {onDelete && (
              <button onClick={onDelete} className="p-1 rounded-full bg-gray-100 hover:bg-red-100 transition-colors">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {/* Org info with inline editing */}
          <div>
            <div className="flex items-start justify-between gap-2">
              {isEditingOrg ? (
                <input
                  type="text"
                  value={editFields.name}
                  onChange={(e) => onEditFieldChange('name', e.target.value)}
                  className="text-base font-bold leading-tight bg-white border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-blue-400 flex-1 min-w-0"
                  style={{ fontSize: 16 }}
                />
              ) : (
                <h2 className="text-base font-bold leading-tight">{org.name}</h2>
              )}
              {org.numUnits && (
                <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-1.5">
                  🏢 {org.numUnits}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{org.address}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {org.distanceFromOfficeKm != null && org.distanceFromOfficeMin != null && (
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  {formatDistance(org.distanceFromOfficeKm, org.distanceFromOfficeMin)}
                </span>
              )}
            </div>
          </div>

          {/* Inline notes */}
          <div>
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

          {/* Chairman section with inline editing */}
          {isEditingOrg ? (
            <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-3 space-y-2">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Adresse</p>
              <input
                type="text"
                placeholder="Adresse"
                value={editFields.address}
                onChange={(e) => onEditFieldChange('address', e.target.value)}
                className="w-full text-sm bg-white border border-gray-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
                style={{ fontSize: 16 }}
              />
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold pt-1">Styreleder</p>
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
            <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded-lg px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Styreleder</p>
                <p className="text-sm font-semibold text-gray-900">{org.chairmanName}</p>
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
                  onClick={() => onEditOrg(org.id)}
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
          ) : (
            <button
              onClick={() => onEditOrg(org.id)}
              className="w-full flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 py-1.5 px-1 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Legg til styreleder
            </button>
          )}

          {/* Feltselger badge (for klar stage) */}
          {org.pipelineStage === 'klar' && org.assignedToId && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
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
          {org.pipelineStage === 'ikke_ringt' && (
            <div className="space-y-2">
              <button onClick={onCall} disabled={loggingResult} className={primaryBtn}>
                <Phone className="w-4 h-4" />Ring
              </button>
              <div className="flex gap-2">
                <button onClick={onEmail} className={`${secondaryBtn} flex-1`}>
                  <Mail className="w-4 h-4" />Send mail
                </button>
                <button onClick={onCallback} className={`${secondaryBtn} flex-1`}>
                  <Clock className="w-4 h-4" />Callback
                </button>
              </div>
              <button onClick={onSms} className={secondaryBtn}>
                <MessageSquareText className="w-4 h-4" />Send SMS
              </button>
            </div>
          )}

          {org.pipelineStage === 'ringt_folg_opp' && (
            <div className="space-y-2">
              <button onClick={onCall} disabled={loggingResult} className={primaryBtn}>
                <Phone className="w-4 h-4" />Ring igjen
              </button>
              <div className="flex gap-2">
                <button onClick={onEmail} className={`${secondaryBtn} flex-1`}>
                  <Mail className="w-4 h-4" />Send mail
                </button>
                <button onClick={onCallback} className={`${secondaryBtn} flex-1`}>
                  <Clock className="w-4 h-4" />Callback
                </button>
              </div>
              <button onClick={onSms} className={secondaryBtn}>
                <MessageSquareText className="w-4 h-4" />Send SMS
              </button>
            </div>
          )}

          {org.pipelineStage === 'venter' && (
            <div className="space-y-2">
              <button onClick={onCall} disabled={loggingResult} className={primaryBtn}>
                <Phone className="w-4 h-4" />Ring for å sjekke
              </button>
              <div className="flex gap-2">
                <button onClick={onMarkVideresendt} className={`${secondaryBtn} flex-1`}>
                  <CheckCircle2 className="w-4 h-4" />Merk videresendt
                </button>
                <button onClick={onEmail} className={`${secondaryBtn} flex-1`}>
                  <Eye className="w-4 h-4" />Vis mal
                </button>
              </div>
            </div>
          )}

          {org.pipelineStage === 'videresendt' && (
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
          )}

          {org.pipelineStage === 'klar' && (
            <button onClick={onBookMeeting} className={boldBtn}>
              <Calendar className="w-4 h-4" />Book møte
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
