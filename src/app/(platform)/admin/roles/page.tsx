'use client'

export const dynamic = 'force-dynamic'

import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState } from '@/components/shared/module-page'

export default function RolesPage() {
  const { data: roles, isLoading } = trpc.users.listRoles.useQuery()

  return (
    <ModulePage
      title="Perfis e Permissões"
      description="Visualização dos perfis de acesso configurados na plataforma"
    >
      <DataCard title={`Perfis (${roles?.length ?? 0})`}>
        {isLoading ? <LoadingState /> : !roles?.length ? (
          <EmptyState icon="🔐" title="Nenhum perfil encontrado" description="Nenhum perfil de acesso cadastrado." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {roles.map((r: any) => (
              <div key={r.id} style={{ padding: '16px', border: '1px solid #f1f5f9', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '15px' }}>{r.label}</span>
                    {r.isSystem && (
                      <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: '500' }}>Sistema</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{r.description || 'Sem descrição'}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>{r.name}</div>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: '#f8fafc', fontSize: '12px', color: '#64748b' }}>
                  ID: {r.id.slice(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </ModulePage>
  )
}
