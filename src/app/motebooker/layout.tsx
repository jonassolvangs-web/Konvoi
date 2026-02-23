'use client';

import RoleShell from '@/components/layout/role-shell';
import { motebookerTabs } from '@/lib/constants';

export default function MotebookerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell requiredRole="MOTEBOOKER" tabs={motebookerTabs}>
      {children}
    </RoleShell>
  );
}
