/** Shared by the history screen and its full export. Dates filter entry time. */
export function sessionFilters(params: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = { status: { $ne: 'void' } }
  const status = params.get('status'), plate = params.get('plate'), shiftId = params.get('shiftId')
  if (status === 'lost') {
    // A lost-card checkout is usually stored as completed with lostCard/lostFine set.
    filter.$or = [{ status: 'lost' }, { lostCard: true }, { lostFine: { $gt: 0 } }]
  } else if (status) {
    filter.status = status
  }
  if (plate) filter.plate = { $regex: plate, $options: 'i' }
  if (shiftId) filter.shiftId = shiftId
  const from = params.get('dateFrom'), to = params.get('dateTo')
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.$gte = new Date(from.includes('T') ? from : `${from}T00:00:00`)
    if (to) range.$lte = new Date(to.includes('T') ? to : `${to}T23:59:59`)
    if (Object.values(range).some(d => !Number.isFinite(d.getTime()))) throw new Error('วันที่ไม่ถูกต้อง')
    if (range.$gte && range.$lte && range.$gte > range.$lte) throw new Error('วันเริ่มต้องไม่เกินวันสิ้นสุด')
    filter.entryTime = range
  }
  return filter
}
