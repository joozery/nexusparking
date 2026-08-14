const { app, Tray, Menu, shell, nativeImage, Notification } = require('electron')
const { createServer } = require('http')
const next = require('next')

let SerialPort
try { SerialPort = require('serialport').SerialPort } catch (e) {
  console.error('[Barrier] serialport module not found:', e.message)
}
const path = require('path')
const url = require('url')

const isDev = !app.isPackaged
const appRoot = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath, 'app')

const APP_PORT    = 3000
const BARRIER_PORT = 8080
const APP_URL     = `http://localhost:${APP_PORT}`
const SERIAL_PORT = 'COM3'
const BAUD_RATE   = 9600

let tray = null
let serialPort = null

// ── Barrier HTTP + Serial ─────────────────────────────────────────
function startBarrierServer() {
  try {
    serialPort = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE })
    serialPort.on('open', () => console.log(`[Barrier] Serial connected: ${SERIAL_PORT}`))
    serialPort.on('error', e => console.error('[Barrier] Serial error:', e.message))
  } catch (e) {
    console.error('[Barrier] Cannot open serial port:', e.message)
  }

  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  createServer((req, res) => {
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
  }).listen(BARRIER_PORT, () => console.log(`[Barrier] HTTP :${BARRIER_PORT}`))
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
})
