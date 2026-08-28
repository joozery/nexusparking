const TH_OFFSET_MS = 7 * 60 * 60 * 1000 // Thailand is UTC+7, no DST

/**
 * Midnight today in Thailand time, as an absolute instant (UTC Date).
 * Computed independently of the server process's own timezone, so "today"
 * always resets at 00:00 Thai time — not at server-local or UTC midnight,
 * which would otherwise drift by hours on servers running in UTC (e.g. Vercel).
 */
export function getTodayStartTH(): Date {
  const thNow = new Date(Date.now() + TH_OFFSET_MS)
  thNow.setUTCHours(0, 0, 0, 0)
  return new Date(thNow.getTime() - TH_OFFSET_MS)
}
