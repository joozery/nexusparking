/**
 * barrier_server.js — รันบน Windows ที่ลานจอดรถ
 * รับ HTTP POST จาก Next.js แล้วส่งคำสั่งเปิดไม้กั้นผ่าน Serial Port
 *
 * ติดตั้ง: npm install serialport
 * รัน:     node barrier_server.js
 */

const http = require('http')
const { SerialPort } = require('serialport')

// ─── ตั้งค่า ────────────────────────────────────────────────────────────────
const SERIAL_PORT  = 'COM3'
const BAUD_RATE    = 9600
const CMD_CHECKIN  = Buffer.from('1\n')   // ขาเข้า
const CMD_CHECKOUT = Buffer.from('2\n')   // ขาออก
const CMD_ALL      = Buffer.from('0\n')   // เปิดทั้งหมด
const HTTP_PORT    = 8080
// ────────────────────────────────────────────────────────────────────────────

let port = null

function connectSerial() {
  port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE, autoOpen: false })

  port.open(err => {
    if (err) {
      console.error('[Serial] เปิดไม่ได้:', err.message)
      console.log('[Serial] ลองรายการ COM ports ที่มี...')
      SerialPort.list().then(ports => {
        if (ports.length === 0) {
          console.log('[Serial] ไม่เจอ COM port เลย')
        } else {
          ports.forEach(p => console.log(`  ${p.path}  —  ${p.friendlyName || ''}`))
        }
      })
      port = null
      return
    }
    console.log(`[Serial] เชื่อมต่อสำเร็จ → ${SERIAL_PORT} @ ${BAUD_RATE} baud`)
  })

  port.on('error', err => {
    console.error('[Serial] Error:', err.message)
    port = null
  })
}

function sendCmd(cmd) {
  return new Promise(resolve => {
    const write = () => {
      port.write(cmd, err => {
        if (err) { console.error('[Barrier] Write error:', err.message); resolve(false) }
        else { console.log('[Barrier] SENT →', cmd.toString()); resolve(true) }
      })
    }
    if (!port || !port.isOpen) {
      connectSerial()
      setTimeout(() => { if (!port || !port.isOpen) { resolve(false) } else { write() } }, 1000)
    } else {
      write()
    }
  })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost`)
  const path   = url.pathname
  const cmd    = url.searchParams.get('cmd')
  const method = req.method

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  console.log(`[HTTP] ${method} ${req.url}`)

  if (method === 'POST' && path === '/barrier') {
    let buf = CMD_CHECKIN
    if (cmd === 'checkout') buf = CMD_CHECKOUT
    else if (cmd === 'all')  buf = CMD_ALL
    const ok = await sendCmd(buf)
    res.writeHead(ok ? 200 : 503, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok }))
  } else {
    res.writeHead(400, CORS_HEADERS)
    res.end()
  }
})

connectSerial()

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Listening on port ${HTTP_PORT}`)
  console.log(`[HTTP] URL: http://100.121.70.116:${HTTP_PORT}/barrier?cmd=open`)
  console.log('กด Ctrl+C เพื่อหยุด')
})
