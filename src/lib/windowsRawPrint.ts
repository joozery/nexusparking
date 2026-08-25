import { spawn } from 'child_process'
import path from 'path'

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'rawprint.ps1')

/**
 * Send raw bytes (RAW datatype, bypasses the driver) to a Windows printer
 * queue by name via winspool.drv (see scripts/rawprint.ps1). For the
 * EPSON TM-T82II, which is USB-attached to this machine — there's no IP
 * to hit like the other hardware.ts devices.
 */
export function sendRawToPrinter(printerName: string, data: Buffer): Promise<boolean> {
  return new Promise(resolve => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT_PATH,
      '-PrinterName', printerName, '-Base64Data', data.toString('base64'),
    ])
    let out = ''
    ps.stdout.on('data', d => { out += d.toString() })
    ps.on('close', code => resolve(code === 0 && out.includes('OK')))
    ps.on('error', () => resolve(false))
  })
}
