// Minimal ambient types for the Web Serial API (not yet in lib.dom.d.ts).
// Chrome/Edge only — used by src/lib/serialReader.ts as a fallback card-reader
// input path for readers that show up as a COM port instead of a HID keyboard.

interface SerialPortRequestOptions {
  filters?: { usbVendorId?: number; usbProductId?: number }[]
}

interface SerialOptions {
  baudRate: number
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  readonly serial?: Serial
}
