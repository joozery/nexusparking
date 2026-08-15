"""
barrier_server.py — รันบน Windows ที่ลานจอดรถ
รับ HTTP POST จาก browser (Next.js operator page) แล้วส่งคำสั่งเปิดไม้กั้นผ่าน Serial

ติดตั้ง: pip install pyserial
รัน:     python barrier_server.py

API:
  POST /barrier?cmd=checkin   → เปิดไม้กั้นขาเข้า  (CHECKIN_CMD)
  POST /barrier?cmd=checkout  → เปิดไม้กั้นขาออก   (CHECKOUT_CMD)
  POST /barrier?cmd=open      → เปิด (backward-compat, เหมือน checkin)
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import serial
import serial.tools.list_ports
import threading

# ─── ตั้งค่า Serial ─────────────────────────────────────────────────────────
SERIAL_PORT  = "COM3"     # แก้เป็น COM port จริง เช่น COM3, COM4
BAUD_RATE    = 9600

# คำสั่งส่งไปยังไม้กั้น — แก้ตามคู่มืออุปกรณ์
# ตัวอย่างทั่วไป:  b'\x01'  /  b'OPEN\r\n'  /  b'1\n'
CHECKIN_CMD  = b'\x01'    # ขาเข้า (ไม้กั้นด้านหน้า)
CHECKOUT_CMD = b'\x02'    # ขาออก  (ไม้กั้นด้านหลัง)
                          # ถ้ามีไม้กั้นเดียว ให้ตั้ง CHECKOUT_CMD = CHECKIN_CMD

HTTP_PORT = 8080

# ────────────────────────────────────────────────────────────────────────────

_lock = threading.Lock()
_ser: serial.Serial | None = None


def _connect():
    global _ser
    try:
        _ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"[Serial] เชื่อมต่อสำเร็จ → {SERIAL_PORT} @ {BAUD_RATE} baud")
    except Exception as e:
        print(f"[Serial] เชื่อมต่อไม่ได้: {e}")
        print("[Serial] COM ports ที่พบ:")
        for p in serial.tools.list_ports.comports():
            print(f"  {p.device}  —  {p.description}")
        _ser = None


def _send(cmd: bytes) -> bool:
    global _ser
    with _lock:
        if _ser is None or not _ser.is_open:
            _connect()
        if _ser is None:
            return False
        try:
            _ser.write(cmd)
            _ser.flush()
            print(f"[Barrier] ส่งคำสั่ง → {cmd!r}")
            return True
        except Exception as e:
            print(f"[Barrier] ส่งไม่สำเร็จ: {e}")
            _ser = None
            return False


_CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


class Handler(BaseHTTPRequestHandler):

    def _cors(self):
        for k, v in _CORS.items():
            self.send_header(k, v)

    def do_OPTIONS(self):
        """Preflight CORS"""
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path != "/barrier":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        cmd = (params.get("cmd") or [""])[0]

        if cmd in ("checkin", "open"):
            ok = _send(CHECKIN_CMD)
        elif cmd == "checkout":
            ok = _send(CHECKOUT_CMD)
        else:
            self.send_response(400)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":false,"error":"unknown cmd"}')
            return

        self.send_response(200 if ok else 503)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}' if ok else b'{"ok":false,"error":"serial error"}')

    def log_message(self, fmt, *args):
        print(f"[HTTP] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    _connect()
    server = HTTPServer(("0.0.0.0", HTTP_PORT), Handler)

    print(f"\n[HTTP] รับคำสั่งบน port {HTTP_PORT}")
    print(f"  ขาเข้า : POST http://0.0.0.0:{HTTP_PORT}/barrier?cmd=checkin")
    print(f"  ขาออก  : POST http://0.0.0.0:{HTTP_PORT}/barrier?cmd=checkout")
    print("[HTTP] กด Ctrl+C เพื่อหยุด\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[HTTP] หยุดแล้ว")
    finally:
        if _ser and _ser.is_open:
            _ser.close()
