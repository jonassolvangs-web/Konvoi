'use client';

import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/ui/loading-spinner';

const TerritoryMapInner = dynamic(() => import('./territory-map-inner'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export default TerritoryMapInner;
