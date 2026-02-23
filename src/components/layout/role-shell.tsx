'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import BottomTabBar from '@/components/ui/bottom-tab-bar';
import LoadingSpinner from '@/components/ui/loading-spinner';

interface TabItem {
  id: string;
  label: string;
  href: string;
  icon: any;
  badge?: number;
}

interface RoleShellProps {
  children: React.ReactNode;
  requiredRole: string;
  tabs: TabItem[];
}

export default function RoleShell({ children, requiredRole, tabs }: RoleShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

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
  if (activeRole !== requiredRole) {
    router.push('/velg-rolle');
    return null;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <main className="flex-1 min-h-0 overflow-auto" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
      <BottomTabBar tabs={tabs} />
    </div>
  );
}
