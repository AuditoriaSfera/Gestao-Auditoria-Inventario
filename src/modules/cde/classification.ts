// ============================================================
// CDE — Motor de classificação (camadas 2 e 3)
// ============================================================
//
// Camada 2 — Natureza: derivada do sinal de "Qtd. movimento" (coluna K).
// Camada 3 — Categoria gerencial: motor de regras parametrizáveis com
//            fallback para regras-padrão embutidas. Movimentos não
//            mapeados retornam PENDENTE_PARAM (bloqueados de validação).
//
// A nomenclatura textual NÃO define entrada/saída — quem define é o sinal
// de Qtd. movimento. As regras de categoria apenas enquadram a movimentação
// numa das 6 categorias oficiais.

import { CDE_CATEGORIES, CDE_NATURE } from './constants'

export type CdeNature = 'ENTRADA' | 'SAIDA' | 'NEUTRA'

export interface ClassificationRule {
  id?: string
  priority: number
  field: 'movimentacao' | 'movimento' | 'descricao' | 'lancamento'
  matchType: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'REGEX'
  pattern: string
  natureFilter?: string | null
  category: string
  isActive?: boolean
}

export interface ClassifiableLine {
  movimentacao?: string | null
  movimento?: string | null
  descricao?: string | null
  lancamento?: string | null
  nature: CdeNature
}

export interface ClassificationResult {
  category: string
  ruleId: string | null
}

/** Remove acentos e normaliza para comparação case/acento-insensível. */
function norm(v: string | null | undefined): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Converte "Qtd. movimento" para número, aceitando formato brasileiro
 * ("1.234,56", "-12") e sinais. Retorna null quando inconvertível.
 */
export function parseQuantity(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = String(v).trim().replace(/[R$\s]/g, '')
  if (s === '') return null
  // formato brasileiro: 1.234,56 -> 1234.56
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? null : n
}

/** Camada 2 — natureza derivada do sinal de Qtd. movimento. */
export function deriveNature(qtdMovimento: number | null): CdeNature {
  if (qtdMovimento === null) return CDE_NATURE.NEUTRA
  if (qtdMovimento > 0) return CDE_NATURE.ENTRADA
  if (qtdMovimento < 0) return CDE_NATURE.SAIDA
  return CDE_NATURE.NEUTRA
}

/**
 * Regras-padrão embutidas. Funcionam de imediato (sem cadastro de
 * parametrização), mas qualquer regra ativa cadastrada tem prioridade
 * (avaliada antes, conforme a ordem de prioridade combinada).
 *
 * Importante: devolução de venda tem natureza ENTRADA e ainda assim é
 * classificada como TROCAS.
 */
export const DEFAULT_RULES: ClassificationRule[] = [
  // Trocas e devoluções (independem da natureza)
  { priority: 10, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'devolu', category: CDE_CATEGORIES.TROCAS },
  { priority: 10, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'troca', category: CDE_CATEGORIES.TROCAS },
  { priority: 12, field: 'descricao', matchType: 'CONTAINS', pattern: 'devolu', category: CDE_CATEGORIES.TROCAS },
  { priority: 12, field: 'descricao', matchType: 'CONTAINS', pattern: 'troca', category: CDE_CATEGORIES.TROCAS },

  // Vendas (saídas)
  { priority: 20, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'venda', natureFilter: 'SAIDA', category: CDE_CATEGORIES.PECAS_VENDIDAS },
  { priority: 20, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'cupom', natureFilter: 'SAIDA', category: CDE_CATEGORIES.PECAS_VENDIDAS },
  { priority: 20, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'pdv', natureFilter: 'SAIDA', category: CDE_CATEGORIES.PECAS_VENDIDAS },

  // Transferências
  { priority: 30, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'transfer', natureFilter: 'ENTRADA', category: CDE_CATEGORIES.ENTRADA_TRANSF },
  { priority: 30, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'transfer', natureFilter: 'SAIDA', category: CDE_CATEGORIES.SAIDAS_TRANSF },

  // Entrada por nota fiscal / compra / recebimento
  { priority: 40, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'nota fiscal', natureFilter: 'ENTRADA', category: CDE_CATEGORIES.ENTRADA_NF },
  { priority: 40, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'compra', natureFilter: 'ENTRADA', category: CDE_CATEGORIES.ENTRADA_NF },
  { priority: 40, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'abastec', natureFilter: 'ENTRADA', category: CDE_CATEGORIES.ENTRADA_NF },
  { priority: 40, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'recebimento', natureFilter: 'ENTRADA', category: CDE_CATEGORIES.ENTRADA_NF },
  { priority: 42, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'entrada nf', natureFilter: 'ENTRADA', category: CDE_CATEGORIES.ENTRADA_NF },

  // Outras saídas: GDV, perdas, avarias, consumo, baixas diversas
  { priority: 50, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'gdv', natureFilter: 'SAIDA', category: CDE_CATEGORIES.OUTRAS_SAIDAS },
  { priority: 50, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'perda', natureFilter: 'SAIDA', category: CDE_CATEGORIES.OUTRAS_SAIDAS },
  { priority: 50, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'avaria', natureFilter: 'SAIDA', category: CDE_CATEGORIES.OUTRAS_SAIDAS },
  { priority: 50, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'consumo', natureFilter: 'SAIDA', category: CDE_CATEGORIES.OUTRAS_SAIDAS },
  { priority: 50, field: 'movimentacao', matchType: 'CONTAINS', pattern: 'baixa', natureFilter: 'SAIDA', category: CDE_CATEGORIES.OUTRAS_SAIDAS },
]

function fieldValue(line: ClassifiableLine, field: ClassificationRule['field']): string {
  switch (field) {
    case 'movimento': return norm(line.movimento)
    case 'descricao': return norm(line.descricao)
    case 'lancamento': return norm(line.lancamento)
    case 'movimentacao':
    default: return norm(line.movimentacao)
  }
}

function ruleMatches(rule: ClassificationRule, line: ClassifiableLine): boolean {
  if (rule.isActive === false) return false
  if (rule.natureFilter && rule.natureFilter !== line.nature) return false

  const value = fieldValue(line, rule.field)
  const pattern = norm(rule.pattern)
  if (!pattern) return false

  switch (rule.matchType) {
    case 'EQUALS': return value === pattern
    case 'STARTS_WITH': return value.startsWith(pattern)
    case 'REGEX':
      try { return new RegExp(rule.pattern, 'i').test(String(value)) } catch { return false }
    case 'CONTAINS':
    default: return value.includes(pattern)
  }
}

/**
 * Camada 3 — classifica a movimentação numa categoria gerencial.
 * Avalia as regras (cadastradas + padrão) por prioridade ascendente;
 * a primeira que casar vence. Sem correspondência → PENDENTE_PARAM.
 */
export function classifyLine(
  line: ClassifiableLine,
  rules: ClassificationRule[] = []
): ClassificationResult {
  const all = [...rules.filter((r) => r.isActive !== false), ...DEFAULT_RULES]
    .sort((a, b) => a.priority - b.priority)

  for (const rule of all) {
    if (ruleMatches(rule, line)) {
      return { category: rule.category, ruleId: rule.id ?? null }
    }
  }
  return { category: CDE_CATEGORIES.PENDENTE_PARAM, ruleId: null }
}
