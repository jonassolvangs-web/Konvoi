'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { LogOut, ArrowRightLeft, Camera } from 'lucide-react';
import Avatar from '@/components/ui/avatar';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import { getRoleLabel } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminProfilPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/users/${(session?.user as any)?.id}/profile-image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await update({ profileImageUrl: data.profileImageUrl });
      toast.success('Profilbilde oppdatert');
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke laste opp bilde');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSwitchRole = async () => {
    const roles = (session?.user as any)?.roles as string[];
    if (roles && roles.length > 1) {
      router.push('/velg-rolle');
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
  };

  if (!session) return null;

  const user = session.user as any;
  const roles = user.roles as string[];

  return (
    <div className="page-container">
      <h1 className="page-title mb-6">Profil</h1>

      {/* Avatar and info */}
      <div className="flex flex-col items-center mb-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group"
        >
          <Avatar name={user.name || 'U'} imageUrl={user.profileImageUrl} size="lg" />
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        <h2 className="text-lg font-bold mt-3">{user.name}</h2>
        <p className="text-sm text-gray-500">{user.email}</p>
        <p className="text-xs text-gray-400 mt-1">{getRoleLabel(user.activeRole)}</p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {roles.length > 1 && (
          <Card hover onClick={handleSwitchRole}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold">Bytt rolle</p>
                <p className="text-xs text-gray-500">
                  {roles.map((r) => getRoleLabel(r)).join(', ')}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Button variant="danger" fullWidth onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logg ut
        </Button>
      </div>
    </div>
  );
}
