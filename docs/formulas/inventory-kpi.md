# Fórmulas — KPI Interno do Time de Inventário

Implementação de referência: `src/modules/inventory/service.ts`

## Indicadores e Fórmulas

### 1. Total de Peças Bipadas
```
total_pieces = SUM(countedQty)
```
Soma de todos os valores de `countedQty` nas linhas do inventário.

### 2. Total de SKU Bipados
```
total_sku = COUNT(rows WHERE countedQty > 0)
```
Quantidade de linhas onde a contagem foi maior que zero.

### 3. Peças por Colaborador
```
pieces_per_collaborator = total_pieces / collaborators_count
```

### 4. SKU por Colaborador
```
sku_per_collaborator = total_sku / collaborators_count
```

### 5. Produtividade por Hora
```
duration_hours = total_duration_min / 60
productivity_per_hour = total_pieces / duration_hours
```

### 6. Peças com Erro de CTG
```
pieces_by_error = SUM(countedQty WHERE errorType = 'ERROR_CTG')
```

### 7. SKU com Erro de CTG
```
sku_by_error = COUNT(rows WHERE errorType = 'ERROR_CTG')
```

### 8. Taxa de Erro
```
error_rate = sku_by_error / total_sku
```

### 9. Taxa de Recontagem
```
recount_rate = recount_count / total_sku
```

## Regras de Negócio

- KPI só é calculado após finalização oficial do inventário
- KPI é versionado: reabertura cria nova versão e invalida a anterior
- `collaborators_count` vem do fechamento, não do arquivo de contagem
- `total_duration_min` pode ser preenchido diretamente ou calculado como `endTime - startTime`
- O arquivo importado é a base oficial — `countedQty` vem sempre do arquivo
