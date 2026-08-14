/**
 * install-service.js — รันครั้งเดียวเพื่อติดตั้ง Windows Service
 * ต้องรันใน PowerShell แบบ Administrator:
 *   node install-service.js
 *
 * ถอนถอนติดตั้ง:
 *   node uninstall-service.js
 */

const { Service } = require('node-windows')
const path = require('path')

const svc = new Service({
  name:        'BarrierServer',
  description: 'ระบบควบคุมไม้กั้นจอดรถ — HTTP to Serial bridge',
  script:      path.join(__dirname, 'barrier_server.js'),
  nodeOptions: [],
  wait:        2,   // รอ 2 วิก่อน restart เมื่อ crash
  grow:        0.5, // เพิ่มเวลารอทุกครั้งที่ crash
})

svc.on('install', () => {
  svc.start()
  console.log('ติดตั้งสำเร็จ — Service กำลังเริ่มต้น')
  console.log('ดูสถานะได้ที่ Services (services.msc) → BarrierServer')
})

svc.on('error', (err) => {
  console.error('เกิดข้อผิดพลาด:', err)
})

svc.install()
