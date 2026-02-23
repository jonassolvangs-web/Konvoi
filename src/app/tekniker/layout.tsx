'use client';

import RoleShell from '@/components/layout/role-shell';
import { teknikerTabs } from '@/lib/constants';

export default function TeknikerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell requiredRole="TEKNIKER" tabs={teknikerTabs}>
      {children}
    </RoleShell>
  );
}
