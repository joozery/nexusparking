import { NextRequest } from 'next/server'
import { GET as previewHistory, DELETE as clearHistory } from '@/app/api/simulate/route'

// Keep the old URL safe for existing clients: never reset card stock or configuration.
// Both screens share authorization, confirmation, locking and lost-card protection.
export async function GET() {
  return previewHistory()
}

export async function DELETE(req: NextRequest) {
  return clearHistory(req)
}
