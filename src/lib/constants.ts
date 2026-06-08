// ============================================================
// CONSTANTES GLOBAIS DA PLATAFORMA SFERA
// ============================================================

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Sfera Multifranquias'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 500,
}

export const MODULES = {
  CDE: 'cde',
  NOTE_TRANSIT: 'note-transit',
  WRITE_OFFS: 'write-offs',
  MERCHANDISE: 'merchandise',
  AUDIT_ROUND: 'audit-round',
  AUDIT_COST: 'audit-cost',
  ASSETS: 'assets',
  INVENTORY: 'inventory',
  INVENTORY_KPI: 'inventory-kpi',
  INVENTORY_COST: 'inventory-cost',
  STRATEGIC: 'strategic',
} as const

export const MODULE_LABELS: Record<string, string> = {
  'cde': 'CDE / Controle de Estoque',
  'note-transit': 'Trânsito de Notas',
  'write-offs': 'Baixas e Perdas',
  'merchandise': 'Conferência de Mercadoria',
  'audit-round': 'Ronda de Auditoria',
  'audit-cost': 'Custo de Auditoria',
  'assets': 'Patrimônio',
  'inventory': 'Inventário',
  'inventory-kpi': 'KPI do Time de Inventário',
  'inventory-cost': 'Custo de Inventário',
  'strategic': 'Indicadores Estratégicos',
}

export const PERMISSIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  IMPORT: 'import',
  EXPORT: 'export',
  APPROVE: 'approve',
  COMMENT: 'comment',
  ATTACH: 'attach',
  CONTEST: 'contest',
  CLOSE_PENDING: 'close-pending',
  REOPEN_PENDING: 'reopen-pending',
  EDIT_PARAMS: 'edit-params',
  VIEW_ALL_STORES: 'view-all-stores',
  MANAGE_USERS: 'manage-users',
  MANAGE_ROLES: 'manage-roles',
} as const

export const SYSTEM_ROLES = {
  PLATFORM_ADMIN: 'platform-admin',
  AUDIT_CORPORATE: 'audit-corporate',
  SUPERVISOR: 'supervisor',
  STORE_MANAGER: 'store-manager',
  STORE_OPERATOR: 'store-operator',
  FINANCIAL: 'financial',
  ASSETS: 'assets',
  INVENTORY: 'inventory',
  BOARD: 'board',
} as const

export const PENDING_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberta',
  IN_ANALYSIS: 'Em Análise',
  WAITING_STORE: 'Aguardando Loja',
  WAITING_AUDIT: 'Aguardando Auditoria',
  RESOLVED_PENDING_VALIDATION: 'Regularizada — Aguardando Validação',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
  REOPENED: 'Reaberta',
}

export const PENDING_STATUS_COLORS: Record<string, string> = {
  OPEN: 'status-open',
  IN_ANALYSIS: 'status-in-analysis',
  WAITING_STORE: 'status-waiting',
  WAITING_AUDIT: 'status-waiting',
  RESOLVED_PENDING_VALIDATION: 'status-resolved',
  CLOSED: 'status-closed',
  CANCELLED: 'status-cancelled',
  EXPIRED: 'status-cancelled',
  REOPENED: 'status-reopened',
}

export const CRITICALITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

export const CRITICALITY_COLORS: Record<string, string> = {
  LOW: 'text-green-600',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
}

export const IMPORT_STATUS_LABELS: Record<string, string> = {
  UPLOADING: 'Enviando',
  VALIDATING: 'Validando',
  STAGING: 'Em Staging',
  READY_TO_PUBLISH: 'Pronto para Publicar',
  PUBLISHING: 'Publicando',
  PUBLISHED: 'Publicado',
  PARTIALLY_PUBLISHED: 'Publicado Parcialmente',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
  ROLLED_BACK: 'Revertido',
}
