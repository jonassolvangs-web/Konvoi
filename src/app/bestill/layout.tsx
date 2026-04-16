import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bestill ventilasjonsrens — Godt Vedlikehold',
  description: 'Book tid for profesjonell ventilasjonsrens. Velg dato og tid — vi fikser resten.',
};

export default function BestillLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
