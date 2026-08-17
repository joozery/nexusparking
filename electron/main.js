const { app, Tray, Menu, shell, nativeImage, Notification } = require('electron')
const { createServer } = require('http')
const { spawn } = require('child_process')
const fs = require('fs')
const next = require('next')

let SerialPort
try { SerialPort = require('serialport').SerialPort } catch (e) {
  console.error('[Barrier] serialport module not found:', e.message)
}
const path = require('path')
const url = require('url')

// ── กันแอป crash จาก uncaught error ──────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message)
  // ไม่ exit — ให้แอปยังทำงานต่อได้
})
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason)
})

const isDev = !app.isPackaged
const appRoot = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath, 'app')

const APP_PORT     = 3000
const BARRIER_PORT = 8181  // เปลี่ยนจาก 8080 → 8181 หลีกเลี่ยงชน service อื่น
const APP_URL      = `http://localhost:${APP_PORT}`
const SERIAL_PORT  = 'COM3'
const BAUD_RATE    = 9600

let tray = null
let serialPort = null
let go2rtcProcess = null

// ── go2rtc (RTSP → MJPEG สำหรับกล้อง CCTV) ───────────────────────────
function startGo2rtc() {
  if (process.platform !== 'win32') return // ฝั่ง Mac ใช้ launchd service แยกต่างหาก (ดู CLAUDE.md)

  const go2rtcDir = path.join(appRoot, 'go2rtc')
  const exePath   = path.join(go2rtcDir, 'go2rtc.exe')
  const cfgPath   = path.join(go2rtcDir, 'go2rtc.yaml')

  if (!fs.existsSync(exePath) || !fs.existsSync(cfgPath)) {
    console.warn('[go2rtc] go2rtc.exe หรือ go2rtc.yaml ไม่พบใน', go2rtcDir, '— ข้ามการเริ่มต้น')
    return
  }

  go2rtcProcess = spawn(exePath, ['-config', cfgPath], { cwd: go2rtcDir })
  go2rtcProcess.stdout.on('data', d => console.log(`[go2rtc] ${d}`.trim()))
  go2rtcProcess.stderr.on('data', d => console.error(`[go2rtc] ${d}`.trim()))
  go2rtcProcess.on('error', e => console.error('[go2rtc] Failed to start:', e.message))
  go2rtcProcess.on('exit', code => {
    console.warn(`[go2rtc] Process exited (code ${code})`)
    go2rtcProcess = null
  })

  console.log('[go2rtc] Started —', exePath)
}

// ── Barrier HTTP + Serial ─────────────────────────────────────────
function startBarrierServer() {
  // เปิด Serial Port (ไม่ crash ถ้าเปิดไม่ได้)
  if (SerialPort) {
    try {
      serialPort = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE })
      serialPort.on('open',  () => console.log(`[Barrier] Serial connected: ${SERIAL_PORT}`))
      serialPort.on('error', e  => console.error('[Barrier] Serial error:', e.message))
    } catch (e) {
      console.error('[Barrier] Cannot open serial port:', e.message)
    }
  }

  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  const server = createServer((req, res) => {
    const parsed = url.parse(req.url, true)
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    if (req.method !== 'POST' || parsed.pathname !== '/barrier') {
      res.writeHead(404); return res.end()
    }

    const cmd = parsed.query.cmd === 'checkout' ? '2\n' : '1\n'
    if (serialPort?.isOpen) {
      serialPort.write(Buffer.from(cmd))
      console.log(`[Barrier] Sent: ${JSON.stringify(cmd)}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, cmd }))
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Serial port not connected' }))
    }
  })

  // จัดการ error โดยไม่ให้ crash แอป
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.warn(`[Barrier] Port ${BARRIER_PORT} already in use — barrier อาจรันอยู่แล้ว, ข้ามการเริ่มต้น`)
    } else {
      console.error('[Barrier] Server error:', e.message)
    }
  })

  server.listen(BARRIER_PORT, '127.0.0.1', () => {
    console.log(`[Barrier] HTTP listening on :${BARRIER_PORT}`)
  })
}

// ── Next.js Server ────────────────────────────────────────────────
async function startNextServer() {
  const nextApp = next({ dev: isDev, dir: appRoot })
  const handle  = nextApp.getRequestHandler()

  await nextApp.prepare()

  await new Promise((resolve) => {
    createServer((req, res) => {
      handle(req, res, url.parse(req.url, true))
    }).listen(APP_PORT, resolve)
  })

  console.log(`[Next.js] Ready → ${APP_URL}`)
}

// ── System Tray ───────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png')
  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) icon = nativeImage.createEmpty()

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('ระบบจอดรถ — กำลังเริ่มต้น...')

  const menu = Menu.buildFromTemplate([
    { label: 'เปิดระบบจอดรถ',   click: () => shell.openExternal(APP_URL) },
    { type: 'separator' },
    { label: 'รีสตาร์ทระบบ',     click: () => { app.relaunch(); app.quit() } },
    { type: 'separator' },
    { label: 'ออกจากโปรแกรม',   click: () => app.quit() },
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => shell.openExternal(APP_URL))
}

// ── Bootstrap ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide()
  app.setLoginItemSettings({ openAtLogin: true })

  createTray()
  startBarrierServer()
  startGo2rtc()

  try {
    await startNextServer()
    tray.setToolTip('ระบบจอดรถ — พร้อมใช้งาน')
    shell.openExternal(APP_URL)
  } catch (err) {
    console.error('[Boot] Failed to start Next.js:', err)
    tray.setToolTip('ระบบจอดรถ — เกิดข้อผิดพลาด!')
  }
})

app.on('window-all-closed', e => e.preventDefault())
app.on('before-quit', () => {
  serialPort?.close()
  go2rtcProcess?.kill()
})
