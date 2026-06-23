'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDateTime } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', SUSPENDED: 'Suspenso', PENDING_ACTIVATION: 'Pendente',
}

type UserForm = { name: string; email: string; password: string; phone: string; roleIds: string[] }
const emptyForm = (): UserForm => ({ name: '', email: '', password: '', phone: '', roleIds: [] })

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none' }

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm())
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.users.list.useQuery({ page, pageSize: 20, search: search || undefined })
  const { data: pendingData, isLoading: pendingLoading } = trpc.users.list.useQuery({ page: 1, pageSize: 100, status: 'PENDING_ACTIVATION' })
  const { data: rolesData } = trpc.users.listRoles.useQuery()

  const createMut = trpc.users.create.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setShowCreate(false); setForm(emptyForm()); setError('') },
    onError: e => setError(e.message),
  })
  const updateMut = trpc.users.update.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setEditUser(null); setError('') },
    onError: e => setError(e.message),
  })
  const deleteMut = trpc.users.softDelete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setConfirmDelete(null) },
  })
  const activateMut = trpc.users.activatePendingUser.useMutation({
    onSuccess: () => { utils.users.list.invalidate() },
  })

  function openEdit(u: any) {
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone ?? '', roleIds: u.roles.map((r: any) => r.role?.id ?? r.roleId) })
    setEditUser(u)
    setError('')
  }

  function handleCreate() {
    if (!form.name || !form.email || !form.password || !form.roleIds.length) {
      setError('Preencha todos os campos obrigatórios e selecione ao menos um perfil.')
      return
    }
    createMut.mutate({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined, roleIds: form.roleIds })
  }

  function handleUpdate() {
    if (!editUser) return
    updateMut.mutate({ id: editUser.id, name: form.name, phone: form.phone || undefined, roleIds: form.roleIds.length ? form.roleIds : undefined })
  }

  function toggleRole(id: string) {
    setForm(f => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter(r => r !== id) : [...f.roleIds, id],
    }))
  }

  const rolesList = rolesData ?? []

  const FormContent = (isEdit: boolean) => (
    <>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
      <Field label="Nome completo" required>
        <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João da Silva" />
      </Field>
      {!isEdit && (
        <Field label="E-mail" required>
          <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@sfera.com.br" />
        </Field>
      )}
      {!isEdit && (
        <Field label="Senha inicial" required>
          <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
        </Field>
      )}
      <Field label="Telefone">
        <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Perfis de acesso" required>
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rolesList.length === 0 && <span style={{ fontSize: '13px', color: '#94a3b8' }}>Carregando perfis...</span>}
          {rolesList.map((r: any) => (
            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>
              <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} style={{ width: '16px', height: '16px' }} />
              <span style={{ fontWeight: '500' }}>{r.label}</span>
              {r.description && <span style={{ color: '#94a3b8', fontSize: '12px' }}>— {r.description}</span>}
            </label>
          ))}
        </div>
      </Field>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Btn variant="outline" onClick={() => { isEdit ? setEditUser(null) : setShowCreate(false); setError('') }}>Cancelar</Btn>
        <Btn onClick={isEdit ? handleUpdate : handleCreate} disabled={createMut.isPending || updateMut.isPending}>
          {createMut.isPending || updateMut.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
        </Btn>
      </div>
    </>
  )

  const pendingUsers = pendingData?.users ?? []
  const hasPending = pendingUsers.length > 0

  return (
    <ModulePage
      title="Usuários"
      description="Gerenciamento de usuários, perfis e escopos de acesso da plataforma"
      actions={<Btn onClick={() => { setShowCreate(true); setForm(emptyForm()); setError('') }}>+ Novo Usuário</Btn>}
    >
      {showCreate && (
        <Modal title="Novo Usuário" onClose={() => { setShowCreate(false); setError('') }}>
          {FormContent(false)}
        </Modal>
      )}
      {editUser && (
        <Modal title={`Editar: ${editUser.name}`} onClose={() => { setEditUser(null); setError('') }}>
          {FormContent(true)}
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Confirmar exclusão" onClose={() => setConfirmDelete(null)}>
          <p style={{ color: '#374151', marginBottom: '20px' }}>
            Tem certeza que deseja excluir o usuário <strong>{confirmDelete.name}</strong>?
            Esta ação não poderá ser desfeita facilmente.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
            <button
              onClick={() => deleteMut.mutate({ id: confirmDelete.id })}
              disabled={deleteMut.isPending}
              style={{ padding: '8px 16px', borderRadius: '8px', background: '#dc2626', color: 'white', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}
            >
              {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </Modal>
      )}

      {hasPending && (
        <DataCard
          title={`E-mails Pendentes de Validação (${pendingUsers.length})`}
          style={{ marginBottom: '24px', borderLeft: '4px solid #f59e0b' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Usuário', 'E-mail', 'Registrado em', 'Ações'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#92400e' }}>
                          {u.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '500', color: '#0f172a' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{u.email}</td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>{formatDateTime(u.createdAt)}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => activateMut.mutate({ id: u.id })}
                          disabled={activateMut.isPending}
                          style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                        >
                          {activateMut.isPending ? 'Ativando...' : '✓ Validar'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      <DataCard
        title={`Usuários (${data?.meta?.total ?? 0})`}
        action={
          <input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', width: '240px' }}
          />
        }
      >
        {isLoading ? <LoadingState /> : !data?.users.length ? (
          <EmptyState icon="👤" title="Nenhum usuário encontrado" description="Crie o primeiro usuário da plataforma." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Usuário', 'E-mail', 'Perfis', 'Último Acesso', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#1d4ed8', flexShrink: 0 }}>
                          {u.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '500', color: '#0f172a' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{u.email}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {u.roles?.map((r: any) => (
                          <span key={r.role?.name} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', background: '#ede9fe', color: '#7c3aed' }}>
                            {r.role?.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Nunca'}</td>
                    <td style={{ padding: '12px' }}><StatusBadge status={u.status} label={STATUS_LABELS[u.status] || u.status} /></td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEdit(u)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#374151' }}>Editar</button>
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => updateMut.mutate({ id: u.id, status: 'INACTIVE' })}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fcd34d', background: '#fefce8', fontSize: '12px', cursor: 'pointer', color: '#92400e' }}
                          >Inativar</button>
                        ) : (
                          <button
                            onClick={() => updateMut.mutate({ id: u.id, status: 'ACTIVE' })}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac', background: '#f0fdf4', fontSize: '12px', cursor: 'pointer', color: '#166534' }}
                          >Ativar</button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(u)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}
                        >Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data.meta?.totalPages ?? 0) > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} usuários</span>
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
