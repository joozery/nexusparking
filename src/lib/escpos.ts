import iconv from 'iconv-lite'

const ESC = 0x1B
const GS  = 0x1D

/** Standard ESC/POS drawer-kick pulse — pin 2, connector 1 (EPSON default DK wiring) */
export function drawerKickCommand(): Buffer {
  return Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA])
}

const INIT        = Buffer.from([ESC, 0x40])                 // ESC @  — reset
const ALIGN_LEFT   = Buffer.from([ESC, 0x61, 0x00])
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01])
const BOLD_ON      = Buffer.from([ESC, 0x45, 0x01])
const BOLD_OFF     = Buffer.from([ESC, 0x45, 0x00])
const CUT          = Buffer.from([GS, 0x56, 0x42, 0x00])     // GS V B 0 — full cut w/ feed
// Select Thai code page — verify against the physical printer; EPSON TM-series
// commonly maps ESC t 21 to a Thai/TIS-620-compatible page. Adjust if receipts
// print garbled Thai glyphs.
const THAI_CODEPAGE = Buffer.from([ESC, 0x74, 21])

function thaiLine(s: string): Buffer {
  return iconv.encode(s, 'tis620')
}

const NL = Buffer.from('\n')
const DIVIDER = thaiLine('--------------------------------\n')

export interface ReceiptData {
  plate:     string
  cardType:  string
  entryTime: string
  exitTime:  string
  duration:  string
  fee:       number
  lostFine?: number
  total:     number
}

const CARD_TYPE_LABEL: Record<string, string> = {
  car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์', overnight: 'ค้างคืน',
}

/** Build a full ESC/POS receipt for the EPSON TM-T82II (58/80mm thermal). */
export function buildReceipt(r: ReceiptData): Buffer {
  const parts: Buffer[] = [INIT, THAI_CODEPAGE, ALIGN_CENTER, BOLD_ON]
  parts.push(thaiLine('ใบเสร็จรับเงิน\n'), thaiLine('NexusParking\n'), BOLD_OFF, NL)
  parts.push(ALIGN_LEFT, DIVIDER)
  parts.push(thaiLine(`ทะเบียน   : ${r.plate}\n`))
  parts.push(thaiLine(`ประเภท    : ${CARD_TYPE_LABEL[r.cardType] ?? r.cardType}\n`))
  parts.push(thaiLine(`เข้า       : ${r.entryTime}\n`))
  parts.push(thaiLine(`ออก       : ${r.exitTime}\n`))
  parts.push(thaiLine(`ระยะเวลา  : ${r.duration}\n`))
  parts.push(DIVIDER)
  parts.push(thaiLine(`ค่าจอดรถ  : ${r.fee.toLocaleString('th-TH')} บาท\n`))
  if (r.lostFine) parts.push(thaiLine(`ค่าปรับบัตรหาย : ${r.lostFine.toLocaleString('th-TH')} บาท\n`))
  parts.push(BOLD_ON, thaiLine(`รวม       : ${r.total.toLocaleString('th-TH')} บาท\n`), BOLD_OFF)
  parts.push(DIVIDER, ALIGN_CENTER, thaiLine('ขอบคุณที่ใช้บริการ\n'))
  parts.push(NL, NL, NL, CUT)
  return Buffer.concat(parts)
}

function thaiDateTime(d: Date): string {
  return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Slip printed when a shift starts — operator's own record of the opening float. */
export function buildShiftStartSlip(data: { operatorName: string; startTime: Date; openingFloat: number; carryoverCars: number }): Buffer {
  const parts: Buffer[] = [INIT, THAI_CODEPAGE, ALIGN_CENTER, BOLD_ON]
  parts.push(thaiLine('เปิดกะการทำงาน\n'), BOLD_OFF, NL, ALIGN_LEFT, DIVIDER)
  parts.push(thaiLine(`พนักงาน   : ${data.operatorName}\n`))
  parts.push(thaiLine(`เวลา      : ${thaiDateTime(data.startTime)}\n`))
  parts.push(thaiLine(`รถค้างในลาน : ${data.carryoverCars} คัน\n`))
  parts.push(DIVIDER)
  parts.push(BOLD_ON, thaiLine(`เงินต้นกะ : ${data.openingFloat.toLocaleString('th-TH')} บาท\n`), BOLD_OFF)
  parts.push(NL, NL, NL, CUT)
  return Buffer.concat(parts)
}

/** Slip printed when a shift ends — operator's own closing summary / cash reconciliation. */
export function buildShiftEndSlip(data: {
  operatorName: string
  startTime: Date
  endTime: Date
  checkinsCount: number
  checkoutsCount: number
  cashAmount: number
  qrAmount: number
  totalAmount: number
  openingFloat: number
  closingFloat: number
  closingCarCount: number
}): Buffer {
  const durMin = Math.round((data.endTime.getTime() - data.startTime.getTime()) / 60000)
  const h = Math.floor(durMin / 60)
  const m = durMin % 60

  const parts: Buffer[] = [INIT, THAI_CODEPAGE, ALIGN_CENTER, BOLD_ON]
  parts.push(thaiLine('ปิดกะการทำงาน\n'), BOLD_OFF, NL, ALIGN_LEFT, DIVIDER)
  parts.push(thaiLine(`พนักงาน   : ${data.operatorName}\n`))
  parts.push(thaiLine(`เวลา      : ${thaiDateTime(data.startTime)} —\n              ${thaiDateTime(data.endTime)}\n`))
  parts.push(thaiLine(`ระยะเวลา  : ${h} ชม. ${m} นาที\n`))
  parts.push(DIVIDER)
  parts.push(thaiLine(`Check-in  : ${data.checkinsCount} คัน\n`))
  parts.push(thaiLine(`Check-out : ${data.checkoutsCount} คัน\n`))
  parts.push(thaiLine(`รายรับเงินสด : ${data.cashAmount.toLocaleString('th-TH')} บาท\n`))
  parts.push(thaiLine(`รายรับ QR    : ${data.qrAmount.toLocaleString('th-TH')} บาท\n`))
  parts.push(BOLD_ON, thaiLine(`รวมทั้งหมด   : ${data.totalAmount.toLocaleString('th-TH')} บาท\n`), BOLD_OFF)
  parts.push(DIVIDER)
  parts.push(thaiLine(`เงินต้นกะ  : ${data.openingFloat.toLocaleString('th-TH')} บาท\n`))
  parts.push(thaiLine(`เงินส่งคืน : ${data.closingFloat.toLocaleString('th-TH')} บาท\n`))
  parts.push(thaiLine(`รถค้างปิดกะ : ${data.closingCarCount} คัน\n`))
  parts.push(NL, NL, NL, CUT)
  return Buffer.concat(parts)
}
