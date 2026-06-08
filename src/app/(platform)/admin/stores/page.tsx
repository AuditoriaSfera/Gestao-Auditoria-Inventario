'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativa', INACTIVE: 'Inativa', CLOSED: 'Fechada' }

type StoreForm = { code: string; name: string; tradeName: string; cnpj: string; regionId: string; address: string; city: string; state: string; phone: string; email: string }
const emptyForm = (): StoreForm => ({ code: '', name: '', tradeName: '', cnpj: '', regionId: '', address: '', city: '', state: '', phone: '', email: '' })

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' as const }
function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div style={{ marginBottom: '14px', width: half ? 'calc(50% - 6px)' : '100%' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

export default function StoresPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editStore, setEditStore] = useState<any | null>(null)
  const [form, setForm] = useState<StoreForm>(emptyForm())
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.stores.list.useQuery({ page, pageSize: 20, search: search || undefined })
  const { data: regions } = trpc.stores.listRegions.useQuery()

  const createMut = trpc.stores.create.useMutation({
    onSuccess: () => { utils.stores.list.invalidate(); setShowCreate(false); setForm(emptyForm()); setError('') },
    onError: e => setError(e.message),
  })
  const updateMut = trpc.stores.update.useMutation({
    onSuccess: () => { utils.stores.list.invalidate(); setEditStore(null); setError('') },
    onError: e => setError(e.message),
  })

  function openEdit(s: any) {
    setForm({ code: s.code, name: s.name, tradeName: s.tradeName ?? '', cnpj: s.cnpj ?? '', regionId: s.regionId ?? '', address: s.address ?? '', city: s.city ?? '', state: s.state ?? '', phone: s.phone ?? '', email: s.email ?? '' })
    setEditStore(s)
    setError('')
  }

  function set(k: keyof StoreForm, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const FormContent = (isEdit: boolean) => (
    <>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Field label="Código *" half><input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value)} placeholder="Ex: SP001" disabled={isEdit} /></Field>
        <Field label="Razão social *" half><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome legal da loja" /></Field>
        <Field label="Nome fantasia" half><input style={inputStyle} value={form.tradeName} onChange={e => set('tradeName', e.target.value)} /></Field>
        <Field label="CNPJ" half><input style={inputStyle} value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" /></Field>
        <Field label="Regional">
          <select style={{ ...inputStyle }} value={form.regionId} onChange={e => set('regionId', e.target.value)}>
            <option value="">Sem regional</option>
            {(regions ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Endereço"><input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="Cidade" half><input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} /></Field>
        <Field label="Estado" half><input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} placeholder="SP" /></Field>
        <Field label="Telefone" half><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="E-mail" half><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Btn variant="outline" onClick={() => { isEdit ? setEditStore(null) : setShowCreate(false); setError('') }}>Cancelar</Btn>
        <Btn onClick={() => {
          if (!form.code || !form.name) { setError('Código e nome são obrigatórios.'); return }
          if (isEdit) updateMut.mutate({ id: editStore.id, name: form.name, tradeName: form.tradeName || undefined, regionId: form.regionId || undefined, address: form.address || undefined, city: form.city || undefined, state: form.state || undefined, phone: form.phone || undefined, email: form.email || undefined })
          else createMut.mutate({ code: form.code, name: form.name, tradeName: form.tradeName || undefined, cnpj: form.cnpj || undefined, regionId: form.regionId || undefined, address: form.address || undefined, city: form.city || undefined, state: form.state || undefined, phone: form.phone || undefined, email: form.email || undefined })
        }} disabled={createMut.isPending || updateMut.isPending}>
          {createMut.isPending || updateMut.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar loja'}
        </Btn>
      </div>
    </>
  )

  return (
    <ModulePage
      title="Lojas"
      description="Cadastro e gestão das lojas da rede Sfera Multifranquias"
      actions={<Btn onClick={() => { setShowCreate(true); setForm(emptyForm()); setError('') }}>+ Nova Loja</Btn>}
    >
      {showCreate && <Modal title="Nova Loja" onClose={() => { setShowCreate(false); setError('') }}>{FormContent(false)}</Modal>}
      {editStore && <Modal title={`Editar: ${editStore.name}`} onClose={() => { setEditStore(null); setError('') }}>{FormContent(true)}</Modal>}

      <DataCard
        title={`Lojas (${data?.meta?.total ?? 0})`}
        action={
          <input placeholder="Buscar por código ou nome..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', width: '220px' }} />
        }
      >
        {isLoading ? <LoadingState /> : !data?.stores.length ? (
          <EmptyState icon="🏪" title="Nenhuma loja cadastrada" description="Cadastre a primeira loja da rede." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Código', 'Nome', 'Regional', 'Cidade/UF', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.stores.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#2563eb', fontFamily: 'monospace' }}>{s.code}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '500', color: '#0f172a' }}>{s.name}</div>
                      {s.tradeName && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.tradeName}</div>}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{s.region?.name ?? '—'}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{s.city ? `${s.city}/${s.state}` : '—'}</td>
                    <td style={{ padding: '12px' }}><StatusBadge status={s.status} label={STATUS_LABELS[s.status] || s.status} /></td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEdit(s)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#374151' }}>Editar</button>
                        {s.status === 'ACTIVE' ? (
                          <button onClick={() => updateMut.mutate({ id: s.id, status: 'INACTIVE' })} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fcd34d', background: '#fefce8', fontSize: '12px', cursor: 'pointer', color: '#92400e' }}>Inativar</button>
                        ) : (
                          <button onClick={() => updateMut.mutate({ id: s.id, status: 'ACTIVE' })} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac', background: '#f0fdf4', fontSize: '12px', cursor: 'pointer', color: '#166534' }}>Ativar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data.meta?.totalPages ?? 0) > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Btn variant="outline" small disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>← Anterior</Btn>
                  <Btn variant="outline" small disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Próxima →</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </DataCard>
    </ModulePage>
  )
}
