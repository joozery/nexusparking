"""
barrier_server.py — รันบน Windows ที่ลานจอดรถ
รับ HTTP POST จาก Next.js แล้วส่งคำสั่งเปิดไม้กั้นผ่าน Serial Port

ติดตั้ง: pip install pyserial
รัน:     python barrier_server.py
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import serial
import serial.tools.list_ports
import threading
import time

# ─── ตั้งค่า Serial Port ────────────────────────────────────────────────────
SERIAL_PORT = "COM3"        # แก้เป็น COM port จริง เช่น COM3, COM4, COM5
BAUD_RATE   = 9600          # ตรวจสอบจากคู่มือไม้กั้น (ส่วนใหญ่ 9600 หรือ 19200)
OPEN_CMD    = b'\x01'       # คำสั่งเปิดไม้กั้น — แก้ตามคู่มือของยี่ห้อที่ใช้
                            # ตัวอย่าง: b'\x01' / b'OPEN\r\n' / b'\xA0\x01\x01\xA2'

HTTP_PORT = 8080            # port ที่ Next.js จะยิง request มา

# ────────────────────────────────────────────────────────────────────────────

ser_lock = threading.Lock()
ser: serial.Serial | None = None


def connect_serial():
    global ser
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"[Serial] Connected → {SERIAL_PORT} @ {BAUD_RATE} baud")
    except Exception as e:
        print(f"[Serial] ERROR: {e}")
        print("[Serial] รายการ COM ports ที่มี:")
        for p in serial.tools.list_ports.comports():
            print(f"  {p.device}  —  {p.description}")
        ser = None


def open_barrier() -> bool:
    global ser
    with ser_lock:
        if ser is None or not ser.is_open:
            connect_serial()
        if ser is None:
            return False
        try:
            ser.write(OPEN_CMD)
            ser.flush()
            print(f"[Barrier] OPEN sent → {OPEN_CMD!r}")
            return True
        except Exception as e:
            print(f"[Barrier] Write error: {e}")
            ser = None
            return False


class Handler(BaseHTTPRequestHandler):

    def do_POST(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/barrier" and params.get("cmd") == ["open"]:
            ok = open_barrier()
            code = 200 if ok else 503
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}' if ok else b'{"ok":false}')
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, fmt, *args):
        print(f"[HTTP] {self.address_string()} — {fmt % args}")


if __name__ == "__main__":
    connect_serial()

    server = HTTPServer(("0.0.0.0", HTTP_PORT), Handler)
    print(f"[HTTP] Listening on port {HTTP_PORT}")
    print(f"[HTTP] Tailscale URL: http://100.121.70.116:{HTTP_PORT}/barrier?cmd=open")
    print("กด Ctrl+C เพื่อหยุด")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if ser and ser.is_open:
            ser.close()
