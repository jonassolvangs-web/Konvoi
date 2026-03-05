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
  if (!vapidKey) return false;

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return false;
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

  return true;
}

export default function ServiceWorkerRegister() {
  const { data: session } = useSession();
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!session?.user) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        setRegistration(reg);

        // If already granted, subscribe silently
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          await subscribeToPush(reg);
          return;
        }

        // If not yet asked, show banner (iOS requires user gesture)
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          setShowBanner(true);
        }
      })
      .catch(() => {});
  }, [session]);

  const handleEnable = async () => {
    if (!registration) return;
    const success = await subscribeToPush(registration);
    setShowBanner(false);
    if (!success) {
      // Permission denied - nothing we can do
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-3 bg-black text-white safe-top animate-in slide-in-from-top">
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <Bell className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm flex-1">Vil du få varsler når nye adresser legges til?</p>
        <button
          onClick={handleEnable}
          className="px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Slå på
        </button>
        <button
          onClick={handleDismiss}
          className="text-gray-400 text-sm hover:text-white transition-colors"
        >
          Nei
        </button>
      </div>
    </div>
  );
}
