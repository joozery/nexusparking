'use client'

// Fallback card-reader input path for readers that enumerate as a COM port
// (Serial UID reader) instead of a HID keyboard-wedge device. Complements the
// keyboard-wedge capture already wired in operator/page.tsx — same UID
// sanitizing, same onCardScanRef hand-off, just a different transport.
//
// Web Serial API — Chrome/Edge only. No server round-trip needed since the
// reader is a peripheral of the same machine running the browser (unlike the
// barrier, which lives on a different Tailscale-only host — see barrierClient.ts).

import { sanitizeUid } from './thaiInput'

const BAUD_STORAGE_KEY = 'np_reader_baud'
export const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 4800] as const

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

export function getReaderBaud(): number {
  if (typeof window === 'undefined') return 9600
  const v = Number(localStorage.getItem(BAUD_STORAGE_KEY))
  return v > 0 ? v : 9600
}

export function setReaderBaud(baud: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BAUD_STORAGE_KEY, String(baud))
}

export interface SerialReaderHandle {
  disconnect(): Promise<void>
}

/**
 * Open a serial card reader and stream UIDs (split on CR/LF) into onUid.
 * requestNew=true prompts the browser's port picker (must run from a user
 * gesture, e.g. a button click). requestNew=false silently reuses a
 * previously-granted port (for auto-reconnect on page load) and resolves to
 * null if none was granted yet.
 */
export async function connectSerialReader(
  onUid: (uid: string) => void,
  onDisconnect: () => void,
  requestNew: boolean,
): Promise<SerialReaderHandle | null> {
  if (!isSerialSupported()) return null
  const serial = navigator.serial!

  const port = requestNew ? await serial.requestPort() : (await serial.getPorts())[0]
  if (!port) return null

  await port.open({ baudRate: getReaderBaud() })
  if (!port.readable) throw new Error('Serial port ไม่มี readable stream')

  const textDecoder = new TextDecoderStream()
  // lib.dom's TextDecoderStream.writable is WritableStream<BufferSource>; Uint8Array satisfies
  // BufferSource at runtime but TS's stream generics don't accept it structurally.
  const pipePromise = port.readable
    .pipeTo(textDecoder.writable as unknown as WritableStream<Uint8Array>)
    .catch(() => {})
  const reader = textDecoder.readable.getReader()

  let cancelled = false
  let buf = ''

  ;(async () => {
    try {
      while (!cancelled) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        buf += value
        let idx: number
        while ((idx = buf.search(/[\r\n]/)) !== -1) {
          const line = sanitizeUid(buf.slice(0, idx))
          buf = buf.slice(idx + 1)
          if (line.length >= 4) onUid(line)
        }
      }
    } finally {
      onDisconnect()
    }
  })()

  return {
    async disconnect() {
      cancelled = true
      try { await reader.cancel() } catch {}
      try { await pipePromise } catch {}
      try { await port.close() } catch {}
    },
  }
}
