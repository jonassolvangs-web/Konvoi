'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Phone, ClipboardList, Wrench, Shield } from 'lucide-react';
import { cn, getRoleLabel } from '@/lib/utils';
import toast from 'react-hot-toast';

const roleIcons: Record<string, any> = {
  ADMIN: Shield,
  MOTEBOOKER: Phone,
  FELTSELGER: ClipboardList,
  TEKNIKER: Wrench,
};

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Administrer brukere, adresser og innstillinger',
  MOTEBOOKER: 'Ring sameier og book møter',
  FELTSELGER: 'Besøk sameier og selg tjenester',
  TEKNIKER: 'Utfør rens og service',
};

const roleRedirects: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  MOTEBOOKER: '/motebooker/kart',
  FELTSELGER: '/feltselger/besok',
  TEKNIKER: '/tekniker/oppdrag',
};

export default function VelgRollePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  if (!session) return null;

  const roles = (session.user as any).roles as string[];

  // If only one role, redirect immediately
  if (roles.length === 1) {
    const role = roles[0];
    // Switch role and redirect
    update({ activeRole: role }).then(() => {
      router.push(roleRedirects[role] || '/');
    });
    return null;
  }

  const handleSelectRole = async (role: string) => {
    setIsLoading(role);
    try {
      await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      await update({ activeRole: role });
      router.push(roleRedirects[role] || '/');
    } catch {
      toast.error('Kunne ikke bytte rolle');
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">K</span>
          </div>
          <h1 className="text-xl font-bold">KONVOI</h1>
          <p className="text-sm text-gray-500 mt-2">Velg din rolle</p>
        </div>

        <div className="space-y-3">
          {roles.map((role) => {
            const Icon = roleIcons[role] || Shield;
            return (
              <button
                key={role}
                onClick={() => handleSelectRole(role)}
                disabled={isLoading !== null}
                className={cn(
                  'w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors text-left',
                  isLoading === role && 'opacity-50'
                )}
              >
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{getRoleLabel(role)}</p>
                  <p className="text-xs text-gray-500">{roleDescriptions[role]}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
