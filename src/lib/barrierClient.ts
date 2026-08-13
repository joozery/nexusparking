// ยิง request ไปหา Windows โดยตรงจาก browser (ไม่ผ่าน Vercel)
export async function triggerBarrierClient(
  direction: 'checkin' | 'checkout'
): Promise<boolean> {
  try {
    const settings = await fetch('/api/settings').then(r => r.json())
    const hw = settings?.hardware?.barrier
    if (!hw?.enabled || !hw?.ip) return false

    const url = `http://${hw.ip}:${hw.port}${hw.endpoint}?cmd=${direction}`
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}
