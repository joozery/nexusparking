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
