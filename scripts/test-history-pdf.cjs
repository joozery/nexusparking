// Run with: node_modules/.bin/electron scripts/test-history-pdf.cjs
// Hidden browser; synthetic records/images only. Saves previews under the OS temp directory.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const ts = require('typescript')
const assert = require('node:assert/strict')
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'parking-export-'))
app.setPath('userData', path.join(output, 'browser'))
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><html lang="th"><body style="font-family:Tahoma,sans-serif">PDF export test</body></html>'))
    const code = ts.transpileModule(fs.readFileSync('src/lib/sessionHistoryExport.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const result = await win.webContents.executeJavaScript(`(async () => {
      const rootRequire = require('node:module').createRequire(${JSON.stringify(path.join(process.cwd(), 'package.json'))});
      const mod = { exports: {} };
      new Function('require','module','exports',${JSON.stringify(code)})(rootRequire,mod,mod.exports);
      const files = [], snapshots = []; let requests = 0;
      const originalURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = blob => { files.push(blob); return originalURL(blob); };
      HTMLAnchorElement.prototype.click = function() {};
      const originalImage = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const data = originalImage.apply(this,args);
        if(this.width === 1240) snapshots.push(data);
        return data;
      };
      const fixture = { _id:'session-test',plate:'กข1234',cardUid:'CARD-001',cardType:'car',entryTime:'2026-09-01T03:00:00Z',exitTime:'2026-09-01T05:00:00Z',durationMin:120,fee:50,discountName:'คูปองร้านอาหาร',discountAmount:10,fineAmount:0,lostFine:0,totalFee:40,status:'completed',paymentMethod:'cash',entryPhotoPath:'entry.jpg',exitPhotoPath:'exit.jpg' };
      window.fetch = async url => {
        requests++;
        const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=360;
        const ctx=canvas.getContext('2d'); const entry=String(url).endsWith('type=entry');
        ctx.fillStyle=entry?'#047857':'#1d4ed8';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='bold 50px Tahoma';ctx.fillText(entry?'ENTRY':'EXIT',200,190);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg'));
        return new Response(blob,{headers:{'Content-Type':'image/jpeg'}});
      };
      const options={includePhotos:true,description:'ทะเบียนทั้งหมด · วันที่เข้า 01/09/2026 ถึง 30/09/2026',signal:new AbortController().signal,onProgress() {}};
      await mod.exports.exportHistoryPDF([fixture,{...fixture,_id:'missing',plate:'ไม่มีรูป',entryPhotoPath:undefined,exitPhotoPath:undefined}],options);
      const withPhotosRequests=requests;
      await mod.exports.exportHistoryPDF(Array.from({length:12},(_,i)=>({...fixture,_id:'row-'+i})),{...options,includePhotos:false});
      const nodefs=rootRequire('node:fs'), nodepath=rootRequire('node:path');
      for(let i=0;i<files.length;i++) nodefs.writeFileSync(nodepath.join(${JSON.stringify(output)},'report-'+i+'.pdf'),Buffer.from(await files[i].arrayBuffer()));
      for(let i=0;i<snapshots.length;i++) nodefs.writeFileSync(nodepath.join(${JSON.stringify(output)},'page-'+i+'.jpg'),Buffer.from(snapshots[i].split(',')[1],'base64'));
      return {withPhotosRequests,totalRequests:requests,files:files.length,pages:snapshots.length};
    })()`)
    assert.equal(result.withPhotosRequests, 2)
    assert.equal(result.totalRequests, 2, 'unchecked exports never fetch photos')
    assert.equal(result.files, 2)
    for (const file of ['report-0.pdf', 'report-1.pdf']) assert.equal(fs.readFileSync(path.join(output, file)).subarray(0, 4).toString(), '%PDF')
    console.log(JSON.stringify({ ...result, output }))
    win.destroy(); app.exit(0)
  } catch (error) { console.error(error); win.destroy(); app.exit(1) }
})
