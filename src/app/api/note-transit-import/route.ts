import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const OPERATION_INDUSTRY = 'COMPRAS DE MERCADORIAS CALAMO'
const OPERATION_TRANSFER = 'ENTRADA POR TRANSFERÊNCIA'
const ALLOWED_OPERATIONS = [OPERATION_INDUSTRY, OPERATION_TRANSFER]
const ALLOWED_STATUS = ['PENDENTE', 'PENDENTE DE ENTREGA', 'INCONSISTENTE']

// Normalize situação variations from the spreadsheet
function normalizeSituacao(raw: string): string | null {
  const s = raw.toUpperCase().trim()
  if (s === 'PENDENTE') return 'PENDENTE'
  if (s === 'PENDENTE DE ENTREGA' || s === 'PENDENTE_ENTREGA') return 'PENDENTE_ENTREGA'
  if (s === 'INCONSISTENTE') return 'INCONSISTENTE'
  return null
}

const SITUACAO_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  PENDENTE_ENTREGA: 'Pendente de Entrega',
  INCONSISTENTE: 'Inconsistente',
}

function cellStr(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text)
  return String(v)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Planilha não encontrada no arquivo' }, { status: 400 })
    }

    const notes: Array<{
      // Spreadsheet columns
      codigoLoja: string       // col A (1)
      codigoFornecedor: string // col B (2)
      nomeFornecedor: string   // col C (3)
      nomeLoja: string         // col D (4)
      empresa: string          // col E (5)
      numeroDocumento: string  // col I (9)
      dataEmissao: string | null // col H (8)
      valorTotal: number       // col X (24)
      // Computed
      leadTime: number
      tipo: 'INDUSTRIA' | 'TRANSFERENCIA'
      tipoLabel: string
      situacao: string
      situacaoLabel: string
      dataEntrega: string
      diasAtraso: number
    }> = []

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const operacaoRaw = cellStr(row, 6).toUpperCase().trim()
      const situacaoRaw = cellStr(row, 7).trim()
      const situacao = normalizeSituacao(situacaoRaw)

      if (!ALLOWED_OPERATIONS.includes(operacaoRaw)) return
      if (!situacao) return

      const codigoLoja = cellStr(row, 1)
      const codigoFornecedor = cellStr(row, 2)
      const nomeFornecedor = cellStr(row, 3)
      const nomeLoja = cellStr(row, 4)
      const empresa = cellStr(row, 5)
      const dataEmissaoRaw = row.getCell(8).value
      const numeroDocumento = cellStr(row, 9)
      const valorTotal = Number(row.getCell(24).value ?? 0)

      let dataEmissao: Date | null = null
      if (dataEmissaoRaw instanceof Date) {
        dataEmissao = dataEmissaoRaw
      } else if (typeof dataEmissaoRaw === 'string' || typeof dataEmissaoRaw === 'number') {
        const parsed = new Date(dataEmissaoRaw)
        if (!isNaN(parsed.getTime())) dataEmissao = parsed
      }

      const leadTime = operacaoRaw === OPERATION_INDUSTRY ? 7 : 4
      const tipo: 'INDUSTRIA' | 'TRANSFERENCIA' = operacaoRaw === OPERATION_INDUSTRY ? 'INDUSTRIA' : 'TRANSFERENCIA'

      const dataEntrega = dataEmissao ? new Date(dataEmissao) : new Date()
      if (dataEmissao) dataEntrega.setDate(dataEmissao.getDate() + leadTime)
      dataEntrega.setHours(0, 0, 0, 0)

      // Negative = overdue (delivery date is in the past)
      const diffMs = dataEntrega.getTime() - hoje.getTime()
      const diasAtraso = Math.round(diffMs / (1000 * 60 * 60 * 24))

      notes.push({
        codigoLoja,
        codigoFornecedor,
        nomeFornecedor,
        nomeLoja,
        empresa,
        numeroDocumento,
        dataEmissao: dataEmissao ? dataEmissao.toISOString() : null,
        valorTotal,
        leadTime,
        tipo,
        tipoLabel: tipo === 'INDUSTRIA' ? 'Indústria' : 'Transferência',
        situacao,
        situacaoLabel: SITUACAO_LABELS[situacao] ?? situacao,
        dataEntrega: dataEntrega.toISOString(),
        diasAtraso,
      })
    })

    // Sort: most overdue first (most negative diasAtraso first)
    notes.sort((a, b) => a.diasAtraso - b.diasAtraso)

    return NextResponse.json({ notes, total: notes.length })
  } catch (err) {
    console.error('Erro ao processar planilha de trânsito:', err)
    return NextResponse.json({ error: 'Erro ao processar o arquivo. Verifique se é uma planilha válida.' }, { status: 500 })
  }
}
