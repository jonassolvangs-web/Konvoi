'use client';

import RoleShell from '@/components/layout/role-shell';
import { feltselgerTabs } from '@/lib/constants';

export default function FeltselgerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell requiredRole="FELTSELGER" tabs={feltselgerTabs}>
      {children}
    </RoleShell>
  );
}
