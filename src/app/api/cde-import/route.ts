import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createHash } from 'crypto'
import { classifyLine, deriveNature, parseQuantity } from '@/modules/cde/classification'
import { CDE_CATEGORIES } from '@/modules/cde/constants'

export const dynamic = 'force-dynamic'

// Mapeamento de cabeçalhos da planilha → campos canônicos.
const HEADER_ALIASES: Record<string, string[]> = {
  loja: ['loja', 'cod loja', 'codigo loja', 'codigo da loja', 'unidade'],
  movimentacao: ['movimentacao', 'movimentação', 'tipo movimentacao', 'tipo de movimentacao'],
  local: ['local'],
  lancamento: ['lancamento', 'lançamento'],
  movimento: ['movimento'],
  cod: ['cod', 'cod.', 'codigo', 'cod produto', 'sku'],
  descricao: ['descricao', 'descrição', 'produto', 'desc'],
  documento: ['documento', 'doc', 'doc.', 'nro documento', 'numero documento', 'n documento'],
  complemento: ['complemento', 'compl', 'observacao', 'obs'],
  saldoAnterior: ['saldo anterior', 'saldo ant', 'saldoanterior'],
  qtdMovimento: ['qtd movimento', 'qtd. movimento', 'quantidade movimento', 'qtd mov', 'qtde movimento', 'quantidade'],
  saldoAtual: ['saldo atual', 'saldoatual', 'saldo'],
}

// Colunas obrigatórias para validar a estrutura mínima do arquivo.
const REQUIRED_FIELDS = ['documento', 'qtdMovimento'] as const

function normalizeHeader(h: string): string {
  return String(h)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function cellValue(cell: ExcelJS.Cell): any {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'object') {
    if ('result' in (v as any)) return (v as any).result
    if ('text' in (v as any)) return (v as any).text
    if (v instanceof Date) return v
  }
  return v
}

function str(v: any): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ error: 'Apenas arquivos .xlsx ou .xls são aceitos.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileHash = createHash('sha256').update(buffer).digest('hex')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Planilha não encontrada no arquivo.' }, { status: 400 })
    }

    // 1) Localiza o cabeçalho e mapeia cada coluna para um campo canônico.
    const headerRow = worksheet.getRow(1)
    const colToField = new Map<number, string>()
    headerRow.eachCell((cell, colNumber) => {
      const norm = normalizeHeader(String(cellValue(cell) ?? ''))
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(norm)) {
          colToField.set(colNumber, field)
          break
        }
      }
    })

    const mappedFields = new Set(colToField.values())
    const missing = REQUIRED_FIELDS.filter((f) => !mappedFields.has(f))
    if (missing.length > 0) {
      const labels: Record<string, string> = { documento: 'Documento', qtdMovimento: 'Qtd. movimento' }
      return NextResponse.json(
        {
          error: `Estrutura inválida. Colunas obrigatórias ausentes: ${missing.map((m) => labels[m]).join(', ')}.`,
        },
        { status: 400 }
      )
    }

    // 2) Lê as linhas de dados.
    type Row = Record<string, any>
    const rows: Row[] = []
    let blankRows = 0

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const raw: Row = {}
      let hasContent = false
      colToField.forEach((field, colNumber) => {
        const v = cellValue(row.getCell(colNumber))
        raw[field] = v
        if (v !== null && v !== undefined && String(v).trim() !== '') hasContent = true
      })
      if (!hasContent) { blankRows++; return }

      const qtd = parseQuantity(raw.qtdMovimento)
      const nature = deriveNature(qtd)
      const line = {
        loja: str(raw.loja),
        movimentacao: str(raw.movimentacao),
        local: str(raw.local),
        lancamento: str(raw.lancamento),
        movimento: str(raw.movimento),
        cod: str(raw.cod),
        descricao: str(raw.descricao),
        documento: str(raw.documento) ?? '',
        complemento: str(raw.complemento),
        saldoAnterior: parseQuantity(raw.saldoAnterior),
        qtdMovimento: qtd ?? 0,
        saldoAtual: parseQuantity(raw.saldoAtual),
        nature,
      }
      // Pré-classificação (apenas regras-padrão) para a pré-visualização.
      const { category } = classifyLine(line, [])
      rows.push({ ...line, rowNumber, category })
    })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'A planilha não contém linhas de dados.' }, { status: 400 })
    }

    // 3) Resumo da pré-visualização.
    const summary = {
      total: rows.length,
      blankRows,
      byNature: {
        ENTRADA: rows.filter((r) => r.nature === 'ENTRADA').length,
        SAIDA: rows.filter((r) => r.nature === 'SAIDA').length,
        NEUTRA: rows.filter((r) => r.nature === 'NEUTRA').length,
      },
      pendingParam: rows.filter((r) => r.category === CDE_CATEGORIES.PENDENTE_PARAM).length,
      documents: new Set(rows.map((r) => r.documento).filter(Boolean)).size,
      stores: new Set(rows.map((r) => r.loja).filter(Boolean)).size,
    }

    return NextResponse.json({ fileName: file.name, fileSize: file.size, fileHash, rows, summary })
  } catch (err) {
    console.error('Erro ao processar planilha CDE:', err)
    return NextResponse.json(
      { error: 'Erro ao processar o arquivo. Verifique se é uma planilha válida.' },
      { status: 500 }
    )
  }
}
