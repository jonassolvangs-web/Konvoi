'use client';

import { useRef, useState } from 'react';
import { X, Phone, MessageSquare, Mail, FileText, Copy, Car, CalendarDays, UserPlus, Wrench, Trash2 } from 'lucide-react';
import { formatDistance, formatPhone } from '@/lib/utils';
import { saveContact } from '@/lib/vcard';
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
  distanceFromOfficeKm: number | null;
  distanceFromOfficeMin: number | null;
  assignedToId: string | null;
  notes: string | null;
}

interface OrgBottomSheetProps {
  org: Organization;
  onClose: () => void;
  onLogResult: (result: string) => void;
  onBookMeeting: () => void;
  onSms: () => void;
  onEmail: () => void;
  onNotes: () => void;
  onCreateWorkOrder?: () => void;
  onDelete?: () => void;
  loggingResult?: boolean;
}

export default function OrgBottomSheet({
  org,
  onClose,
  onLogResult,
  onBookMeeting,
  onSms,
  onEmail,
  onNotes,
  onCreateWorkOrder,
  onDelete,
  loggingResult,
}: OrgBottomSheetProps) {
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

  return (
    <div
      className="absolute inset-0 z-[1000] flex flex-col animate-slide-up"
      style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined, transition: dragOffset === 0 ? 'transform 0.2s ease-out' : 'none' }}
    >
      {/* Map peek area - click to close */}
      <div className="h-16 shrink-0" onClick={onClose} />

      {/* Panel */}
      <div className="flex-1 flex flex-col bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
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
          {/* Org info + inline stats */}
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

          {/* Notes */}
          {org.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-medium text-amber-700 uppercase mb-0.5">Notat</p>
              <p className="text-sm text-amber-900">{org.notes}</p>
            </div>
          )}

          {/* Chairman section */}
          {org.chairmanName && (
            <div className="border border-gray-100 rounded-xl px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase">Styreleder</span>
                  <p className="text-sm font-semibold leading-tight">{org.chairmanName}</p>
                </div>
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
            <div className="flex gap-2">
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

          {/* Quick actions */}
          <div className="grid grid-cols-5 gap-1.5">
            <button onClick={onSms} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <MessageSquare className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] text-gray-600">SMS</span>
            </button>
            <button onClick={onEmail} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <Mail className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] text-gray-600">E-post</span>
            </button>
            <button onClick={onNotes} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <FileText className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] text-gray-600">Notater</span>
            </button>
            <button onClick={onBookMeeting} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <CalendarDays className="h-4 w-4 text-gray-600" />
              <span className="text-[10px] text-gray-600">Book møte</span>
            </button>
            {onCreateWorkOrder && (
              <button onClick={onCreateWorkOrder} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <Wrench className="h-4 w-4 text-gray-600" />
                <span className="text-[10px] text-gray-600">Oppdrag</span>
              </button>
            )}
          </div>

          {/* Emoji result bar */}
          <div className="flex items-center justify-around">
            {[
              { result: 'ikke_svar', emoji: '❄️', label: 'Ingen svar' },
              { result: 'ring_tilbake', emoji: '📞', label: 'Callback' },
              { result: 'mote_booket', emoji: '✅', label: 'Fullført' },
              { result: 'nei', emoji: '🚫', label: 'Nei' },
            ].map((btn) => (
              <button
                key={btn.result}
                onClick={() => onLogResult(btn.result)}
                disabled={loggingResult}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl hover:bg-gray-50 active:scale-90 transition-all disabled:opacity-50"
              >
                <span className="text-xl">{btn.emoji}</span>
                <span className="text-[10px] text-gray-500 font-medium">{btn.label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
