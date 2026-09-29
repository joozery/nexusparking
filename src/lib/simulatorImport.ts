import * as XLSX from 'xlsx'

/** Datetime inputs use local wall time; never remove the Z from a UTC value. */
export function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
}

export function parseDateTimeSplit(dateCol: unknown, timeCol: unknown, date1904 = false): Date | null {
  let y: number, m: number, d: number
  if (dateCol instanceof Date && Number.isFinite(dateCol.getTime())) {
    y = dateCol.getFullYear(); m = dateCol.getMonth() + 1; d = dateCol.getDate()
  } else if (typeof dateCol === 'number') {
    const p = XLSX.SSF.parse_date_code(dateCol, { date1904 })
    if (!p) return null
    y = p.y; m = p.m; d = p.d
  } else if (typeof dateCol === 'string') {
    const s = dateCol.trim()
    const thai = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    const iso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
    if (thai) { y = +thai[3]; m = +thai[2]; d = +thai[1] }
    else if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
    else return null
    if (y < 100) y += 2000
    if (y > 2500) y -= 543
  } else return null

  let h: number, min: number, sec: number
  if (timeCol instanceof Date && Number.isFinite(timeCol.getTime())) {
    h = timeCol.getHours(); min = timeCol.getMinutes(); sec = timeCol.getSeconds()
  } else if (typeof timeCol === 'number' && Number.isFinite(timeCol) && timeCol >= 0 && timeCol < 1) {
    const seconds = Math.min(86399, Math.round(timeCol * 86400))
    h = Math.floor(seconds / 3600); min = Math.floor(seconds / 60) % 60; sec = seconds % 60
  } else if (typeof timeCol === 'string') {
    const t = timeCol.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (!t) return null
    h = +t[1]; min = +t[2]; sec = +(t[3] ?? 0)
  } else return null
  if (y < 1901 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59 || sec > 59) return null
  const result = new Date(y, m - 1, d, h, min, sec)
  if (result.getFullYear() !== y || result.getMonth() !== m - 1 || result.getDate() !== d) return null
  return result
}

export interface ImportDiscount {
  _id: unknown
  name: string
  discountType: 'fixed' | 'percent' | 'per_day'
  discountValue: number
  maxDiscount?: number
}

/** Match checkout rules: shop discounts for hourly visits, hotel discounts for nights. */
export function importDiscounts(fee: number, nights: number, shopName: string, hotelName: string, discounts: ImportDiscount[]) {
  const match = (name: string, hotel: boolean) => {
    if (!name.trim()) return null
    const found = discounts.filter(d => d.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (found.length !== 1) throw new Error(`ไม่พบชื่อส่วนลดที่ตรงกันและไม่ซ้ำ: ${name}`)
    if ((found[0].discountType === 'per_day') !== hotel) throw new Error(`ประเภทส่วนลดไม่ตรงกับคอลัมน์: ${name}`)
    return found[0]
  }
  const shopDisc = match(shopName, false), hotelDisc = match(hotelName, true)
  let shopAmt = 0, hotelAmt = 0
  if (shopDisc && nights === 0) {
    shopAmt = shopDisc.discountType === 'fixed' ? shopDisc.discountValue : Math.floor(fee * shopDisc.discountValue / 100)
    if (shopDisc.discountType === 'percent' && shopDisc.maxDiscount) shopAmt = Math.min(shopAmt, shopDisc.maxDiscount)
    shopAmt = Math.max(0, Math.min(fee, shopAmt))
  }
  if (hotelDisc && nights > 0) hotelAmt = Math.max(0, Math.min(fee, hotelDisc.discountValue * nights))
  const warning = [shopDisc && nights > 0 ? 'ไม่ใช้ส่วนลดร้านค้ากับรายการค้างคืน' : '', hotelDisc && nights === 0 ? 'ไม่มีคืนที่คิดค่าเหมาจึงไม่ใช้ส่วนลดโรงแรม' : ''].filter(Boolean).join(' · ')
  return { shopDisc, hotelDisc, shopAmt, hotelAmt, total: shopAmt + hotelAmt, final: fee - shopAmt - hotelAmt, warning }
}
