import { createTRPCRouter } from './init'
import { authRouter } from '@/modules/core/auth/router'
import { usersRouter } from '@/modules/core/users/router'
import { storesRouter } from '@/modules/core/stores/router'
import { importsRouter } from '@/modules/core/imports/router'
import { pendingRouter } from '@/modules/core/pending/router'
import { notificationsRouter } from '@/modules/core/notifications/router'
import { cdeRouter } from '@/modules/cde/router'
import { noteTransitRouter } from '@/modules/note-transit/router'
import { writeOffsRouter } from '@/modules/write-offs/router'
import { merchandiseRouter } from '@/modules/merchandise/router'
import { auditRoundRouter } from '@/modules/audit-round/router'
import { auditCostRouter } from '@/modules/audit-cost/router'
import { auditCollaboratorsRouter } from '@/modules/audit-cost/collaborators-router'
import { auditTripsRouter } from '@/modules/audit-cost/trips-router'
import { auditFormsRouter } from '@/modules/audit-cost/forms-router'
import { auditCostTypesRouter } from '@/modules/audit-cost/cost-types-router'
import { auditInformativeCostsRouter } from '@/modules/audit-cost/informative-costs-router'
import { auditCollaboratorSalariesRouter } from '@/modules/audit-cost/collaborator-salaries-router'
import { assetsRouter } from '@/modules/assets/router'
import { patrimonioRouter } from '@/modules/assets/patrimonio-router'
import { inventoryRouter } from '@/modules/inventory/router'
import { inventoryKpiRouter } from '@/modules/inventory-kpi/router'
import { inventoryCostRouter } from '@/modules/inventory-cost/router'
import { strategicRouter } from '@/modules/strategic/router'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  users: usersRouter,
  stores: storesRouter,
  imports: importsRouter,
  pending: pendingRouter,
  notifications: notificationsRouter,
  cde: cdeRouter,
  noteTransit: noteTransitRouter,
  writeOffs: writeOffsRouter,
  merchandise: merchandiseRouter,
  auditRound: auditRoundRouter,
  auditCost: auditCostRouter,
  auditCollaborators: auditCollaboratorsRouter,
  auditTrips: auditTripsRouter,
  auditForms: auditFormsRouter,
  auditCostTypes: auditCostTypesRouter,
  auditInformativeCosts: auditInformativeCostsRouter,
  auditCollaboratorSalaries: auditCollaboratorSalariesRouter,
  assets: assetsRouter,
  patrimonio: patrimonioRouter,
  inventory: inventoryRouter,
  inventoryKpi: inventoryKpiRouter,
  inventoryCost: inventoryCostRouter,
  strategic: strategicRouter,
})

export type AppRouter = typeof appRouter
