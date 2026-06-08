# Fórmulas — Custo de Auditoria

Implementação de referência: `src/modules/audit-cost/router.ts`

## Indicadores do Painel Mensal

O mês de referência é identificado automaticamente pela data do lançamento de despesa.
**Não existe campo "mês de referência" manual.**

### 1. Custo Total de Viagens
```
total_trip_cost = SUM(expense.value) WHERE date IN [month_start, month_end]
```

### 2. Custo da Equipe
```
team_cost = SUM(auditor_base_cost.monthly_cost)
            WHERE valid_from <= month_end
            AND (valid_until IS NULL OR valid_until >= month_start)
```
Custo base dos auditores é parametrizável com vigência em `auditor_base_costs`.

### 3. Custo Total da Operação
```
total_operation_cost = total_trip_cost + team_cost
```

### 4. Custo Médio por Loja (viagens)
```
avg_cost_per_store = total_trip_cost / total_stores_visited
```

### 5. Custo Médio por Loja (com equipe)
```
avg_total_cost_per_store = total_operation_cost / total_stores_visited
```
`total_stores_visited` vem da soma de `audit_trips.stores_count` no período.

## Regras

- Despesas são agrupadas automaticamente por mês da data do lançamento
- Custo base por auditor tem início e fim de vigência (`valid_from`, `valid_until`)
- Comprovantes são vinculados ao lançamento individual, não à viagem
- Sem aprovação obrigatória na versão 1
