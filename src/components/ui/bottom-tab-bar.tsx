'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import { ArrowRightLeft, LogOut, Phone, ClipboardList, Wrench, Shield, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

interface BottomTabBarProps {
  tabs: TabItem[];
}

const roleConfig: Record<string, { label: string; icon: LucideIcon; href: string; color: string }> = {
  ADMIN: { label: 'Admin', icon: Shield, href: '/admin/dashboard', color: 'bg-purple-100 text-purple-700' },
  MOTEBOOKER: { label: 'Møtebooker', icon: Phone, href: '/motebooker/kart', color: 'bg-blue-100 text-blue-700' },
  FELTSELGER: { label: 'Feltselger', icon: ClipboardList, href: '/feltselger/besok', color: 'bg-green-100 text-green-700' },
  TEKNIKER: { label: 'Tekniker', icon: Wrench, href: '/tekniker/oppdrag', color: 'bg-orange-100 text-orange-700' },
};

export default function BottomTabBar({ tabs }: BottomTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, update } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const [switching, setSwitching] = useState(false);

  const activeRole = (session?.user as any)?.activeRole as string | undefined;
  const roles = ((session?.user as any)?.roles as string[]) || [];
  const userName = (session?.user as any)?.name as string | undefined;

  const handleSwitchRole = async (role: string) => {
    if (role === activeRole || switching) return;
    setSwitching(true);
    try {
      await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      await update({ activeRole: role });
      setShowMenu(false);
      router.push(roleConfig[role]?.href || '/');
    } catch {
      // ignore
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      {/* User menu popup */}
      {showMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)}>
          <div
            className="absolute bottom-16 right-3 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[180px] animate-slide-up"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {userName && (
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500">Innlogget som</p>
                <p className="text-sm font-semibold truncate">{userName}</p>
              </div>
            )}
            {roles.length > 1 && (
              <>
                <div className="px-4 pt-2 pb-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Bytt rolle</p>
                </div>
                {roles.map((role) => {
                  const conf = roleConfig[role];
                  if (!conf) return null;
                  const Icon = conf.icon;
                  const isActive = role === activeRole;
                  return (
                    <button
                      key={role}
                      onClick={() => handleSwitchRole(role)}
                      disabled={switching}
                      className={cn(
                        'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors',
                        isActive ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{conf.label}</span>
                      {isActive && <span className="ml-auto text-[10px] text-gray-400">aktiv</span>}
                    </button>
                  );
                })}
              </>
            )}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logg ut</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-0 flex-1 touch-target',
                  isActive ? 'text-black' : 'text-gray-400'
                )}
              >
                <div className="relative">
                  <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 h-4 min-w-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium truncate">{tab.label}</span>
              </Link>
            );
          })}

          {/* User menu (role switch + logout) */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-0',
              showMenu ? 'text-black' : 'text-gray-400'
            )}
          >
            {roles.length > 1 ? (
              <ArrowRightLeft className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <User className="h-5 w-5" strokeWidth={1.5} />
            )}
            <span className="text-[10px] font-medium">{roles.length > 1 ? 'Meny' : 'Konto'}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
