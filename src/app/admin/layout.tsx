'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LogOut } from 'lucide-react';
import BottomTabBar from '@/components/ui/bottom-tab-bar';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { adminTabs } from '@/lib/constants';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <LoadingSpinner fullPage size="lg" />;
  }

  if (!session) return null;

  const activeRole = (session.user as any).activeRole;
  if (activeRole !== 'ADMIN') {
    router.push('/velg-rolle');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-gray-50 border-r border-gray-200">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-200">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white text-sm font-bold">K</span>
          </div>
          <span className="text-sm font-bold">KONVOI</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {adminTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <tab.icon className="h-5 w-5" strokeWidth={1.5} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200">
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.5} />
            Logg ut
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="pb-20 md:pb-0 md:ml-56">
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabBar tabs={adminTabs} />
    </div>
  );
}
