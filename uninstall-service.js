const { Service } = require('node-windows')
const path = require('path')

const svc = new Service({
  name:   'BarrierServer',
  script: path.join(__dirname, 'barrier_server.js'),
})

svc.on('uninstall', () => {
  console.log('ถอนติดตั้งสำเร็จ — Service ถูกลบออกแล้ว')
})

svc.uninstall()
