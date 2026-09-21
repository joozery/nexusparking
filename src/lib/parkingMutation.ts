import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { connectDB } from './mongodb'

/** Serialize parking writes across server processes on standalone MongoDB too.
 * No timeout takeover: a paused writer must never overlap a new owner.
 * A lock left by a crashed process requires review before manual removal.
 */
export function parkingMutation<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const db = await connectDB()
    const locks = db.connection.collection<{ _id: string; owner: string; createdAt: Date }>('parking_mutation_locks')
    const owner = randomUUID()
    try {
      await locks.insertOne({ _id: 'parking', owner, createdAt: new Date() })
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
      return NextResponse.json({ error: 'ระบบกำลังบันทึกรายการรถ กรุณารอสักครู่แล้วลองใหม่ หากแจ้งซ้ำให้ผู้ดูแลตรวจสอบ' }, { status: 409 })
    }
    try {
      return await handler(...args)
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'บัตรนี้มีรายการใช้งานอยู่แล้ว กรุณารีเฟรชและตรวจรถในลานหรือคิวรอ' }, { status: 409 })
      }
      throw error
    } finally {
      await locks.deleteOne({ _id: 'parking', owner })
    }
  }
}
