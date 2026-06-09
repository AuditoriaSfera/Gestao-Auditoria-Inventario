import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const ALLOWED_OPERATIONS = ['COMPRAS DE MERCADORIAS CALAMO', 'ENTRADA POR TRANSFERÊNCIA']
const ALLOWED_STATUS = ['PENDENTE', 'PENDENTE_ENTREGA', 'INCONSISTENTE']

const SITUACAO_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  PENDENTE_ENTREGA: 'Pendente de Entrega',
  INCONSISTENTE: 'Inconsistente',
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
      codigoLoja: string
      codigoFornecedor: string
      nomeFornecedor: string
      dataEmissao: string | null
      valorTotal: number
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

      const operacao = String(row.getCell(6).value ?? '').toUpperCase().trim()
      const situacaoRaw = String(row.getCell(7).value ?? '').toUpperCase().trim()

      if (!ALLOWED_OPERATIONS.includes(operacao)) return
      if (!ALLOWED_STATUS.includes(situacaoRaw)) return

      const codigoLoja = String(row.getCell(1).value ?? '')
      const codigoFornecedor = String(row.getCell(2).value ?? '')
      const nomeFornecedor = String(row.getCell(3).value ?? '')
      const dataEmissaoRaw = row.getCell(8).value
      const valorTotal = Number(row.getCell(24).value ?? 0)

      let dataEmissao: Date | null = null
      if (dataEmissaoRaw instanceof Date) {
        dataEmissao = dataEmissaoRaw
      } else if (typeof dataEmissaoRaw === 'string' || typeof dataEmissaoRaw === 'number') {
        const parsed = new Date(dataEmissaoRaw)
        if (!isNaN(parsed.getTime())) dataEmissao = parsed
      }

      const leadTime = operacao === 'COMPRAS DE MERCADORIAS CALAMO' ? 7 : 4
      const tipo: 'INDUSTRIA' | 'TRANSFERENCIA' =
        operacao === 'COMPRAS DE MERCADORIAS CALAMO' ? 'INDUSTRIA' : 'TRANSFERENCIA'

      const dataEntrega = dataEmissao ? new Date(dataEmissao) : new Date()
      if (dataEmissao) dataEntrega.setDate(dataEmissao.getDate() + leadTime)

      const diffMs = hoje.getTime() - dataEntrega.getTime()
      const diasAtraso = Math.round(diffMs / (1000 * 60 * 60 * 24))

      notes.push({
        codigoLoja,
        codigoFornecedor,
        nomeFornecedor,
        dataEmissao: dataEmissao ? dataEmissao.toISOString() : null,
        valorTotal,
        leadTime,
        tipo,
        tipoLabel: tipo === 'INDUSTRIA' ? 'Indústria' : 'Transferência',
        situacao: situacaoRaw,
        situacaoLabel: SITUACAO_LABELS[situacaoRaw] ?? situacaoRaw,
        dataEntrega: dataEntrega.toISOString(),
        diasAtraso,
      })
    })

    notes.sort((a, b) => b.diasAtraso - a.diasAtraso)

    return NextResponse.json({ notes, total: notes.length })
  } catch (err) {
    console.error('Erro ao processar planilha de trânsito:', err)
    return NextResponse.json({ error: 'Erro ao processar o arquivo. Verifique se é uma planilha válida.' }, { status: 500 })
  }
}
