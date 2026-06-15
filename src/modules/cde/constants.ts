// ============================================================
// CDE — CONFRONTO DIÁRIO DE ESTOQUE
// Constantes do módulo (rótulos, categorias, status, SLA)
// Mantidas dentro do módulo para preservar o escopo exclusivo do CDE.
// ============================================================

/** As 6 categorias gerenciais oficiais do CDE + categoria de exceção. */
export const CDE_CATEGORIES = {
  ENTRADA_NF: 'ENTRADA_NF',
  ENTRADA_TRANSF: 'ENTRADA_TRANSF',
  PECAS_VENDIDAS: 'PECAS_VENDIDAS',
  SAIDAS_TRANSF: 'SAIDAS_TRANSF',
  OUTRAS_SAIDAS: 'OUTRAS_SAIDAS',
  TROCAS: 'TROCAS',
  PENDENTE_PARAM: 'PENDENTE_PARAM',
} as const

export type CdeCategory = (typeof CDE_CATEGORIES)[keyof typeof CDE_CATEGORIES]

export const CDE_CATEGORY_LABELS: Record<string, string> = {
  ENTRADA_NF: 'Entrada NF',
  ENTRADA_TRANSF: 'Entrada Transferência',
  PECAS_VENDIDAS: 'Peças Vendidas',
  SAIDAS_TRANSF: 'Saídas Transferência',
  OUTRAS_SAIDAS: 'Outras Saídas',
  TROCAS: 'Trocas',
  PENDENTE_PARAM: 'Pendente de Parametrização',
}

/** Apenas as 6 categorias oficiais (sem a de exceção) — usado em selects/admin. */
export const CDE_OFFICIAL_CATEGORIES = [
  'ENTRADA_NF',
  'ENTRADA_TRANSF',
  'PECAS_VENDIDAS',
  'SAIDAS_TRANSF',
  'OUTRAS_SAIDAS',
  'TROCAS',
] as const

export const CDE_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  ENTRADA_NF: { bg: '#dcfce7', text: '#15803d' },
  ENTRADA_TRANSF: { bg: '#e0f2fe', text: '#0369a1' },
  PECAS_VENDIDAS: { bg: '#ede9fe', text: '#6d28d9' },
  SAIDAS_TRANSF: { bg: '#fef3c7', text: '#b45309' },
  OUTRAS_SAIDAS: { bg: '#ffedd5', text: '#c2410c' },
  TROCAS: { bg: '#cffafe', text: '#0e7490' },
  PENDENTE_PARAM: { bg: '#fee2e2', text: '#dc2626' },
}

/** Natureza da movimentação (camada 2). */
export const CDE_NATURE = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  NEUTRA: 'NEUTRA',
} as const

export const CDE_NATURE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  NEUTRA: 'Neutra / Inconsistente',
}

export const CDE_NATURE_COLORS: Record<string, { bg: string; text: string }> = {
  ENTRADA: { bg: '#dcfce7', text: '#15803d' },
  SAIDA: { bg: '#fee2e2', text: '#dc2626' },
  NEUTRA: { bg: '#f1f5f9', text: '#64748b' },
}

/** Status oficiais do módulo. */
export const CDE_STATUS = {
  PENDING_VALIDATION: 'PENDING_VALIDATION',
  CORRECT: 'CORRECT',
  INCORRECT: 'INCORRECT',
  REGULARIZED: 'REGULARIZED',
  PENDING_PARAM: 'PENDING_PARAM',
} as const

export const CDE_STATUS_LABELS: Record<string, string> = {
  PENDING_VALIDATION: 'Pendente de validação',
  CORRECT: 'Correto',
  INCORRECT: 'Incorreto',
  REGULARIZED: 'Regularizado',
  PENDING_PARAM: 'Pendente de Parametrização',
}

export const CDE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING_VALIDATION: { bg: '#fef3c7', text: '#b45309' },
  CORRECT: { bg: '#dcfce7', text: '#15803d' },
  INCORRECT: { bg: '#fee2e2', text: '#dc2626' },
  REGULARIZED: { bg: '#dbeafe', text: '#1d4ed8' },
  PENDING_PARAM: { bg: '#fee2e2', text: '#b91c1c' },
}

/** Ações de validação disponíveis. */
export const CDE_VALIDATION_ACTIONS = {
  CORRECT: 'CORRECT',
  INCORRECT: 'INCORRECT',
  FORWARDED_AUDIT: 'FORWARDED_AUDIT',
} as const

export const CDE_VALIDATION_ACTION_LABELS: Record<string, string> = {
  CORRECT: 'Correto',
  INCORRECT: 'Incorreto',
  FORWARDED_AUDIT: 'Encaminhado para auditoria',
}

/** SLA de validação: 24 horas a partir da importação; alerta a 4h do vencimento. */
export const CDE_SLA_DEADLINE_HOURS = 24
export const CDE_SLA_WARNING_HOURS = 4

/** Semáforo de SLA por loja. */
export type CdeSlaState = 'GREEN' | 'YELLOW' | 'RED'

export const CDE_SLA_LABELS: Record<CdeSlaState, string> = {
  GREEN: 'Concluída',
  YELLOW: 'Próxima do vencimento',
  RED: 'Em atraso',
}

export const CDE_SLA_COLORS: Record<CdeSlaState, { bg: string; text: string }> = {
  GREEN: { bg: '#dcfce7', text: '#15803d' },
  YELLOW: { bg: '#fef3c7', text: '#b45309' },
  RED: { bg: '#fee2e2', text: '#dc2626' },
}
