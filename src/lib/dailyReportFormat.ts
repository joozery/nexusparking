const DAY = 86_400_000
const OFFSET = 7 * 3_600_000

export function thaiDayStart(now: Date): Date {
  return new Date(Math.floor((now.getTime() + OFFSET) / DAY) * DAY - OFFSET)
}

export function splitLineReport(text: string, limit = 4000): string[] {
  const chunks: string[] = []
  let chunk = ''
  for (const line of text.split('\n')) {
    // Slice long user-supplied names too, keeping every request below LINE's limit.
    const pieces = line.match(new RegExp(`.{1,${limit}}`, 'gu')) ?? ['']
    for (const piece of pieces) {
      if (chunk.length + piece.length + 1 > limit) { chunks.push(chunk); chunk = '' }
      chunk += (chunk ? '\n' : '') + piece
    }
  }
  if (chunk) chunks.push(chunk)
  return chunks.map((part, index) => `รายงานประจำวัน (${index + 1}/${chunks.length})\n${part}`)
}

export const reportMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const reportTime = (date: Date) => date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', second: '2-digit', minute: '2-digit', hour: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })

export function cashBreakdown(counts: Record<string, number> | Map<string, number> | undefined): string[] {
  const entries = counts instanceof Map ? [...counts.entries()] : Object.entries(counts ?? {})
  return entries.filter(([, count]) => count > 0).sort(([a], [b]) => Number(b) - Number(a))
    .map(([value, count]) => `${Number(value).toLocaleString('th-TH')} × ${count} = ${reportMoney(Number(value) * count)} บาท`)
}
