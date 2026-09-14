import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportColumn {
  key: string
  label: string    // Thai label — used for Excel + on-screen table
  pdfLabel: string // English label — jsPDF's built-in fonts have no Thai glyphs
  format?: (value: unknown) => string
}

function cellText(row: object, col: ExportColumn): string {
  const raw = (row as Record<string, unknown>)[col.key]
  return col.format ? col.format(raw) : String(raw ?? '')
}

export function exportRowsToExcel<T extends object>(
  rows: T[],
  columns: ExportColumn[],
  filename: string,
) {
  const data = rows.map(row => {
    const obj: Record<string, string> = {}
    for (const col of columns) obj[col.label] = cellText(row, col)
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// jsPDF's standard fonts (helvetica/times/courier) have no Thai glyphs, so this export
// uses English column labels — the Excel export and on-screen table stay in Thai.
export function exportRowsToPDF<T extends object>(
  rows: T[],
  columns: ExportColumn[],
  filename: string,
  title: string,
) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('Column labels are in English — jsPDF cannot render Thai text.', 14, 21)

  autoTable(doc, {
    startY: 26,
    head: [columns.map(c => c.pdfLabel)],
    body: rows.map(row => columns.map(col => cellText(row, col))),
    styles: { font: 'helvetica', fontSize: 8 },
    headStyles: { fillColor: [161, 98, 7] },
  })

  doc.save(`${filename}.pdf`)
}
