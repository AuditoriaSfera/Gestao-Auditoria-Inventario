'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'

export default function CleanupPage() {
  const [done, setDone] = useState<{ viagens: number; informativos: number } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const cleanup = trpc.users.cleanupTestData.useMutation({
    onSuccess: (data) => {
      setDone({ viagens: data.viagens, informativos: data.informativos })
      setConfirming(false)
    },
  })

  return (
    <div style={{ maxWidth: '480px', margin: '60px auto', padding: '40px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Limpar Dados de Teste</h1>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
        Esta ação irá excluir <strong>todas as viagens com status diferente de "Aberta"</strong> e <strong>todos os custos informativos</strong>. As viagens abertas serão mantidas.
      </p>

      {done ? (
        <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <div style={{ fontWeight: '700', color: '#166534', fontSize: '16px' }}>Limpeza concluída!</div>
          <div style={{ color: '#166534', marginTop: '8px', fontSize: '14px' }}>
            {done.viagens} viagem(ns) excluída(s)<br />
            {done.informativos} custo(s) informativo(s) excluído(s)
          </div>
        </div>
      ) : !confirming ? (
        <button
          onClick={() => setConfirming(true)}
          style={{ width: '100%', padding: '14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
        >
          Excluir dados de teste
        </button>
      ) : (
        <div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
            ⚠️ Tem certeza? Esta ação não pode ser desfeita.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setConfirming(false)}
              style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => cleanup.mutate()}
              disabled={cleanup.isPending}
              style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: cleanup.isPending ? 'not-allowed' : 'pointer', opacity: cleanup.isPending ? 0.7 : 1 }}
            >
              {cleanup.isPending ? 'Excluindo...' : 'Confirmar exclusão'}
            </button>
          </div>
        </div>
      )}

      {cleanup.error && (
        <div style={{ marginTop: '16px', color: '#dc2626', fontSize: '13px' }}>{cleanup.error.message}</div>
      )}
    </div>
  )
}
