// Hidden Electron renderer. All requests are mocked; never connects to the parking database.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), ts = require('typescript')
const assert = require('node:assert/strict')
const root = process.cwd()
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'parking-simulator-ui-'))
app.setPath('userData', path.join(output, 'browser')); app.disableHardwareAcceleration()
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><body><div id="root"></div></body></html>'))
    const result = await win.webContents.executeJavaScript(`(async () => {
      const req=require('node:module').createRequire(${JSON.stringify(path.join(root, 'package.json'))});
      const React=req('react'), {createRoot}=req('react-dom/client'), XLSX=req('xlsx');
      // data: test pages are not secure contexts; localhost in the app is.
      if (!crypto.randomUUID) crypto.randomUUID = () => req('node:crypto').randomUUID();
      function load(code, imports={}) { const m={exports:{}}; new Function('require','module','exports',code)(n=>n in imports?imports[n]:req(n),m,m.exports); return m.exports; }
      const helpers=load(${JSON.stringify(compile('src/lib/simulatorImport.ts'))});
      const calc=load(${JSON.stringify(compile('src/lib/calcFee.ts'))});
      let posted=null;const errors=[];
      const page=load(${JSON.stringify(compile('src/app/(dashboard)/simulator/page.tsx'))},{
        '@/lib/calcFee':calc,'@/lib/simulatorImport':helpers,
        '@/components/parking/SimulatorCheckout':{SimulatorCheckout:()=>null},
        '@/components/ui/Toast':{useToast:()=>({success(){},warning(){},error:(...args)=>errors.push(args)})},
      });
      window.fetch=async (url,options)=>{
        const json=data=>({ok:true,json:async()=>data});
        if(url==='/api/settings')return json({lostCardFine:300,rates:{overnight:{windowStart:'18:00',windowEnd:'07:00',flatRateStart:'22:00',flatRate:100,extraHour:20}}});
        if(url==='/api/discounts?active=1')return json([]);
        if(url==='/api/cards')return json([{uid:'0001',type:'car',label:'บัตร 1',isActive:true}]);
        if(url==='/api/simulate' && options?.method==='POST'){
          const body=JSON.parse(options.body);if(body.mode!=='preview')throw Error('Real save is prohibited in UI test');
          posted=body;return json({token:'preview',ready:30,duplicates:0,errors:0,total:0,results:body.rows.map(r=>({...r,status:r.exitTime?'completed':'active',fee:0,discount:0,lostFine:0,total:0,duplicate:false}))});
        }
        throw Error('Unexpected request: '+url);
      };
      const wait=async test=>{for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,50));}throw Error('UI wait timeout: '+JSON.stringify(errors)+' '+document.body.innerText.slice(-500));};
      createRoot(document.getElementById('root')).render(React.createElement(page.default));
      await wait(()=>document.querySelector('input[type=file]'));
      const data=[['ทะเบียน','ประเภท','วันที่เข้า','เวลาเข้า','วันที่ออก','เวลาออก']];
      for(let i=0;i<30;i++)data.push([String(1000+i),'car','01/09/2026','09:00',i===29?'':'01/09/2026',i===29?'':'10:00']);
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'test');
      const file=new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'fixture.xlsx');const dt=new DataTransfer();dt.items.add(file);
      const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      await wait(()=>document.querySelectorAll('select[aria-label^="บัตรแถว"]').length===30);
      for(const select of document.querySelectorAll('select[aria-label^="บัตรแถว"]')){select.value='0001';select.dispatchEvent(new Event('change',{bubbles:true}));}
      const lost=document.querySelector('input[aria-label="บัตรหายแถว 31"]');lost.click();
      const payment=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.text==='เลือกช่องทาง'));
      payment.value='cash';payment.dispatchEvent(new Event('change',{bubbles:true}));
      await wait(()=>!([...document.querySelectorAll('button')].find(b=>b.textContent==='ตรวจสอบก่อนบันทึก')).disabled);
      [...document.querySelectorAll('button')].find(b=>b.textContent==='ตรวจสอบก่อนบันทึก').click();
      await wait(()=>document.body.textContent.includes('ยืนยันบันทึก 30 รายการ'));
      const captured=JSON.parse(JSON.stringify(posted));
      lost.click();await wait(()=>!document.body.textContent.includes('ยืนยันบันทึก 30 รายการ'));
      const queueModule=load(${JSON.stringify(compile('src/components/parking/SimulatorCheckout.tsx'))},{
        './CheckOutDialog':{CheckOutDialog:()=>null},'@/lib/calcFee':calc,'@/lib/simulatorImport':helpers,
        '@/components/ui/Toast':{useToast:()=>({success(){},error:(...args)=>errors.push(args)})},
      });
      let queueSlots=0,admitted=0;
      let queueFixtures=[{_id:'q1',cardUid:'C1',cardType:'car',plate:'Q100',joinedAt:'2026-01-01T09:00:00Z'},
        {_id:'q2',cardUid:'C2',cardType:'car',plate:'Q200',joinedAt:'2026-01-01T09:01:00Z'}];
      window.fetch=async(url,options)=>{
        const json=data=>({ok:true,json:async()=>data});
        if(url.startsWith('/api/sessions?'))return json({sessions:[]});
        if(url==='/api/queue')return json(queueFixtures);
        if(url==='/api/stats')return json({car:{available:queueSlots},motorcycle:{available:0}});
        if(url==='/api/queue/q1/enter' && options.method==='POST'){
          if(queueSlots!==1)throw Error('Entry attempted without space');
          admitted++;queueSlots=0;queueFixtures=queueFixtures.slice(1);return json({});
        }
        throw Error('Unexpected queue request: '+url);
      };
      const queueHost=document.createElement('div');document.body.appendChild(queueHost);
      createRoot(queueHost).render(React.createElement(queueModule.SimulatorCheckout,{config:null,lostCardFine:300}));
      await wait(()=>queueHost.querySelector('input[aria-label="เลือกคิว Q100"]'));
      queueHost.querySelector('input[aria-label="เลือกคิว Q100"]').click();
      const enterButton=()=>[...queueHost.querySelectorAll('button')].find(b=>b.textContent==='เข้าช่องจอด');
      await wait(()=>queueHost.textContent.includes('ลานประเภทนี้เต็ม'));
      if(!enterButton().disabled)throw Error('Queue entry should be disabled when full');
      queueSlots=1;[...queueHost.querySelectorAll('button')].find(b=>b.textContent==='รีเฟรชรายการ').click();
      await wait(()=>!enterButton().disabled);enterButton().click();
      await wait(()=>admitted===1 && !queueHost.querySelector('input[aria-label="เลือกคิว Q100"]'));
      queueHost.querySelector('input[aria-label="เลือกคิว Q200"]').click();
      await wait(()=>enterButton().disabled && queueHost.textContent.includes('ลานประเภทนี้เต็ม'));
      return {rows:captured.rows.length,allAssigned:captured.rows.every(r=>r.cardUid==='0001'),last:captured.rows[29],errors,invalidated:true};
    })()`)
    assert.equal(result.rows, 30); assert.equal(result.allAssigned, true)
    assert.equal(result.last.exitTime, ''); assert.equal(result.last.lostCard, true)
    assert.deepEqual(result.errors, []); assert.equal(result.invalidated, true)
    console.log('Simulator browser test passed: 30 Excel rows, registered-card selection, open visit, lost checkbox, preview invalidation and queue checkbox/admission/capacity refresh; all requests mocked.')
    win.destroy(); app.exit(0)
  } catch (error) { console.error(error); win.destroy(); app.exit(1) }
})
