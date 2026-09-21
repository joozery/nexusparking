export function parkingDuration(entry: string | Date, exit: string | Date): string {
  const seconds = Math.max(0, Math.floor((new Date(exit).getTime() - new Date(entry).getTime()) / 1000))
  return `${Math.floor(seconds / 86400)} วัน ${Math.floor(seconds % 86400 / 3600)} ชั่วโมง ${Math.floor(seconds % 3600 / 60)} นาที ${seconds % 60} วินาที`
}
