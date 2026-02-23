'use client';

import { useEffect, useState } from 'react';
import { Plus, Mail, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import FilterChips from '@/components/ui/filter-chips';
import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/loading-spinner';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  type: 'email' | 'sms';
  title: string;
  subject?: string;
  body: string;
}

const typeFilters = [
  { id: 'alle', label: 'Alle' },
  { id: 'email', label: 'E-post' },
  { id: 'sms', label: 'SMS' },
];

const VARIABLES = ['{{navn}}', '{{adresse}}', '{{dato}}', '{{tidspunkt}}', '{{selger}}', '{{enheter}}'];

export default function MalerPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('alle');
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({ type: 'email' as 'email' | 'sms', title: '', subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // For now, use local state with default templates
    setTemplates([
      {
        id: '1',
        type: 'email',
        title: 'Første kontakt',
        subject: 'Ventilasjonsrens for {{navn}}',
        body: 'Hei,\n\nVi kontakter deg angående ventilasjonsrens for {{navn}} på {{adresse}}.\n\nVi tilbyr profesjonell ventilasjonsrens som forbedrer inneklimaet og reduserer energiforbruket.\n\nKan vi avtale et tidspunkt for befaring?\n\nMed vennlig hilsen,\n{{selger}}',
      },
      {
        id: '2',
        type: 'email',
        title: 'Oppfølging etter samtale',
        subject: 'Oppfølging - Ventilasjonsrens {{navn}}',
        body: 'Hei,\n\nTakk for hyggelig samtale. Som avtalt sender jeg mer informasjon om ventilasjonsrens for {{navn}}.\n\nVi har avtalt befaring {{dato}} kl. {{tidspunkt}}.\n\nMed vennlig hilsen,\n{{selger}}',
      },
      {
        id: '3',
        type: 'sms',
        title: 'Påminnelse møte',
        body: 'Hei! Påminnelse om befaring i morgen kl. {{tidspunkt}} på {{adresse}}. Mvh {{selger}}',
      },
      {
        id: '4',
        type: 'sms',
        title: 'Ikke hjemme',
        body: 'Hei! Vi var innom {{adresse}} i dag, men traff ingen. Ring oss gjerne på tlf for å avtale nytt tidspunkt. Mvh {{selger}}',
      },
    ]);
    setLoading(false);
  }, []);

  const filtered = templates.filter((t) => typeFilter === 'alle' || t.type === typeFilter);

  const openCreate = () => {
    setEditTemplate(null);
    setForm({ type: 'email', title: '', subject: '', body: '' });
    setShowModal(true);
  };

  const openEdit = (template: Template) => {
    setEditTemplate(template);
    setForm({ type: template.type, title: template.title, subject: template.subject || '', body: template.body });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title || !form.body) {
      toast.error('Fyll ut tittel og innhold');
      return;
    }
    setSaving(true);

    if (editTemplate) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === editTemplate.id ? { ...t, ...form } : t))
      );
      toast.success('Mal oppdatert');
    } else {
      setTemplates((prev) => [...prev, { id: Date.now().toString(), ...form }]);
      toast.success('Mal opprettet');
    }

    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success('Mal slettet');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Maler</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ny mal
        </Button>
      </div>

      <FilterChips chips={typeFilters} activeChip={typeFilter} onChange={setTypeFilter} className="mb-4" />

      {filtered.length === 0 ? (
        <EmptyState title="Ingen maler" description="Opprett din første mal" />
      ) : (
        <div className="space-y-3">
          {filtered.map((template) => (
            <Card key={template.id}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {template.type === 'email' ? (
                    <Mail className="h-4 w-4 text-blue-500" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-green-500" />
                  )}
                  <Badge
                    size="sm"
                    color={template.type === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}
                  >
                    {template.type === 'email' ? 'E-post' : 'SMS'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(template); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-sm font-semibold mb-1">{template.title}</h3>
              {template.subject && (
                <p className="text-xs text-gray-500 mb-1">Emne: {template.subject}</p>
              )}
              <p className="text-xs text-gray-500 line-clamp-2">{template.body}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {VARIABLES.filter((v) => template.body.includes(v) || (template.subject && template.subject.includes(v))).map((v) => (
                  <span key={v} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{v}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTemplate ? 'Rediger mal' : 'Ny mal'}>
        <div className="space-y-4">
          <div>
            <label className="label">Type</label>
            <div className="flex gap-2">
              {(['email', 'sms'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    form.type === type
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {type === 'email' ? 'E-post' : 'SMS'}
                </button>
              ))}
            </div>
          </div>
          <Input label="Tittel" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          {form.type === 'email' && (
            <Input label="Emne" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          )}
          <div>
            <label className="label">Innhold</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={6}
              className="input-field resize-none"
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Tilgjengelige variabler:</p>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, body: f.body + ' ' + v }))}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} isLoading={saving} fullWidth>
            {editTemplate ? 'Lagre endringer' : 'Opprett mal'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
