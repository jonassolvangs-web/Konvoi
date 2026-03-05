'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('VAPID-nøkkel mangler');

  if (typeof Notification === 'undefined') {
    throw new Error('Enheten din støtter ikke push-varsler. Krever iOS 16.4+ eller nyere Android.');
  }

  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    throw new Error('Du avviste varsler. Gå til innstillinger for å slå dem på.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  await fetch('/api/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
}

export default function ServiceWorkerRegister() {
  const { data: session } = useSession();
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!session?.user) return;

    // Don't show if already dismissed
    if (localStorage.getItem('push-banner-dismissed')) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        setRegistration(reg);

        // If already granted and subscribed, don't show banner
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const existing = await reg.pushManager.getSubscription();
          if (existing) {
            // Re-send subscription to server in case it's missing
            await fetch('/api/push-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(existing.toJSON()),
            }).catch(() => {});
            return;
          }
        }

        // Show banner for all users
        setShowBanner(true);
      })
      .catch(() => {});
  }, [session]);

  const handleEnable = async () => {
    if (!registration) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await subscribeToPush(registration);
      setStatus('success');
      localStorage.setItem('push-banner-dismissed', '1');
      setTimeout(() => setShowBanner(false), 2000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Kunne ikke aktivere varsler');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push-banner-dismissed', '1');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-4 bg-black text-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className="max-w-lg mx-auto">
        {status === 'success' ? (
          <p className="text-sm text-center text-green-400 font-medium">Push-varsler er aktivert!</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm flex-1">Vil du få varsler når nye adresser legges til?</p>
            </div>
            {errorMsg && (
              <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={status === 'loading'}
                className="flex-1 px-3 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {status === 'loading' ? 'Aktiverer...' : 'Slå på varsler'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors"
              >
                Ikke nå
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
