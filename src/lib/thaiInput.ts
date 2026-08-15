// Thai Kedmanee keyboard → ASCII mapping (USB card-reader keyboard-wedge fix)
export const THAI_TO_EN: Record<string, string> = {
  'ๅ': '`', 'ภ': '3', 'ถ': '4', 'ุ': '5', 'ึ': '6',
  'ค': '7', 'ต': '8', 'จ': '9', 'ข': '0', 'ช': '-',
  '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5',
  '๖': '6', '๗': '7', '๘': '8', '๙': '9', '๐': '0',
  'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't',
  'ั': 'y', 'ี': 'u', 'ร': 'i', 'น': 'o', 'ย': 'p',
  'บ': '[', 'ล': ']',
  'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f', 'เ': 'g',
  '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': "'",
  'ผ': 'z', 'ป': 'x', 'แ': 'c', 'อ': 'v', 'ิ': 'b',
  'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
  'ฎ': 'E', 'ฑ': 'R', 'ธ': 'T', 'ณ': 'I', 'ฯ': 'O', 'ญ': 'P',
  'ฤ': 'A', 'ฆ': 'S', 'ฏ': 'D', 'โ': 'F', 'ฌ': 'G',
  '็': 'H', '๋': 'J', 'ษ': 'K', 'ศ': 'L', 'ซ': ':',
  'ฉ': 'C', 'ฮ': 'V', 'ฺ': 'B', 'ฒ': 'M',
}

/** Map every Thai character (keyboard layout + digit variants) to its ASCII equivalent */
export function convertThaiToEn(s: string): string {
  return s.split('').map(c => THAI_TO_EN[c] ?? c).join('')
}

/**
 * Convert a plate-number input value to ASCII digits only.
 * Handles both Thai keyboard chars (จ→9, ต→8, …) and Thai digit chars (๑→1, …).
 */
export function toAsciiPlate(s: string): string {
  return convertThaiToEn(s).replace(/\D/g, '')
}
