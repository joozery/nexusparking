/** Decode physical US keyboard positions used by USB readers, independently of OS layout. */
export function hidKey(event: { code: string; key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): string | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  if (/^(Digit|Numpad)[0-9]$/.test(event.code)) return event.code.slice(-1)
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(-1)
  if (event.code === 'Enter' || event.code === 'NumpadEnter') return 'Enter'
  if (event.code === 'Minus' || event.code === 'NumpadSubtract') return '-'
  if (event.code === 'Space') return ' '
  if (event.code === 'Semicolon') return event.key === ':' ? ':' : ';'
  return event.key.length === 1 && (!event.code || event.code === 'Unidentified') ? event.key : null
}

/** Recognize a keyboard reader burst without treating normal plate typing as a tap. */
export function createHidScan() {
  let text = ''
  let lastTime = 0
  return (key: string, time: number): string | null => {
    if (time - lastTime > 80) text = ''
    lastTime = time
    if (key === 'Enter') {
      const result = text.length >= 4 ? text : null
      text = ''
      return result
    }
    if (key.length === 1) text += key
    else if (key !== 'Shift') text = ''
    return null
  }
}
