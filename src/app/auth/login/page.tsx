'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast.error('Feil e-post eller passord');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-black flex items-center justify-center mb-4">
            <span className="text-white text-xl font-bold">K</span>
          </div>
          <h1 className="text-xl font-bold">KONVOI</h1>
          <p className="text-sm text-gray-500 mt-1">Logg inn for å fortsette</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-post"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@epost.no"
            required
          />
          <Input
            label="Passord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Skriv inn passord"
            required
          />
          <Button type="submit" isLoading={isLoading} fullWidth size="lg">
            Logg inn
          </Button>
        </form>
      </div>
    </div>
  );
}
