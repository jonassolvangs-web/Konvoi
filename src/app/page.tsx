import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  const activeRole = (session.user as any).activeRole;
  const roles = (session.user as any).roles as string[];

  if (!activeRole && roles.length > 1) {
    redirect('/velg-rolle');
  }

  const role = activeRole || roles[0];

  switch (role) {
    case 'ADMIN':
      redirect('/admin/dashboard');
    case 'MOTEBOOKER':
      redirect('/motebooker/kart');
    case 'FELTSELGER':
      redirect('/feltselger/besok');
    case 'TEKNIKER':
      redirect('/tekniker/oppdrag');
    default:
      redirect('/auth/login');
  }
}
