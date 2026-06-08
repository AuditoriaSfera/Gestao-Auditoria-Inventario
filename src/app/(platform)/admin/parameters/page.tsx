'use client'

export const dynamic = 'force-dynamic'

import { ModulePage, DataCard, EmptyState } from '@/components/shared/module-page'

export default function ParametersPage() {
  const params = [
    { key: 'sla.cde.deadline_hours', label: 'SLA CDE — Prazo (horas)', value: '48', module: 'cde', type: 'number' },
    { key: 'sla.note_transit.late_hours', label: 'SLA Trânsito de Notas — Atraso (horas)', value: '72', module: 'note-transit', type: 'number' },
    { key: 'inventory.loss_alert_pct', label: 'Alerta de perda no inventário (%)', value: '2.0', module: 'inventory', type: 'number' },
    { key: 'audit.min_score_pct', label: 'Pontuação mínima na ronda (%)', value: '70', module: 'audit-round', type: 'number' },
  ]

  return (
    <ModulePage
      title="Parâmetros do Sistema"
      description="Configurações globais e por módulo da plataforma"
    >
      <DataCard title="Parâmetros configurados">
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '13px', color: '#92400e' }}>
          ⚙️ A edição de parâmetros via interface será implementada em breve. Os valores abaixo são os padrões do sistema.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {params.map(p => (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
              <div>
                <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '14px' }}>{p.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{p.key}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: '#ede9fe', color: '#7c3aed', fontWeight: '500' }}>{p.module}</span>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a', minWidth: '48px', textAlign: 'right' }}>{p.value}</span>
              </div>
            </div>
          ))}
        </div>
      </DataCard>
    </ModulePage>
  )
}
