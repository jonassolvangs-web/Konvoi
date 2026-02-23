'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Avatar from '@/components/ui/avatar';
import Badge from '@/components/ui/badge';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';
import SearchBar from '@/components/ui/search-bar';
import { cn, getRoleLabel } from '@/lib/utils';
import toast from 'react-hot-toast';

const ROLES = ['ADMIN', 'MOTEBOOKER', 'FELTSELGER', 'TEKNIKER'];

export default function AnsattePage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', roles: [] as string[] });
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', phone: '', password: '', roles: [] });
    setShowModal(true);
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, phone: user.phone || '', password: '', roles: user.roles });
    setShowModal(true);
  };

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.email || form.roles.length === 0) {
      toast.error('Fyll ut alle påkrevde felt');
      return;
    }
    if (!editUser && !form.password) {
      toast.error('Passord er påkrevd');
      return;
    }

    setSaving(true);
    try {
      const body: any = { name: form.name, email: form.email, phone: form.phone, roles: form.roles };
      if (form.password) body.password = form.password;

      const url = editUser ? `/api/admin/users/${editUser.id}` : '/api/admin/users';
      const method = editUser ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editUser ? 'Bruker oppdatert' : 'Bruker opprettet');
      setShowModal(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Ansatte</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ny ansatt
        </Button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Søk ansatte..." className="mb-4" />

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <Card key={user.id} hover onClick={() => openEdit(user)}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar name={user.name} imageUrl={user.profileImageUrl} />
                {user.isActive && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {user.roles.map((role: string) => (
                    <Badge key={role} size="sm" color="bg-gray-100 text-gray-700">
                      {getRoleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{user._count.callRecords} samtaler</p>
                <p>{user._count.visits} besøk</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Rediger ansatt' : 'Ny ansatt'}>
        <div className="space-y-4">
          <Input label="Navn" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="E-post" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Input label="Telefon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input
            label={editUser ? 'Nytt passord (la stå tomt for å beholde)' : 'Passord'}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required={!editUser}
          />
          <div>
            <label className="label">Roller</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    form.roles.includes(role)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {getRoleLabel(role)}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} isLoading={saving} fullWidth>
            {editUser ? 'Lagre endringer' : 'Opprett ansatt'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
