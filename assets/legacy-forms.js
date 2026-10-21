
const FORMS={
  ADVANCE:{label:'預支單',layout:'advance',header:'',version:'',
    roles:['LO','NO','財務長'],receipt:false,midLabel:'',
    rule:'單號規則　年度＋部門代碼＋L＋流水號'},
  ADVG:{label:'經費預支單（行政／計畫）',layout:'advance',header:'',version:'',
    advG:true,
    roles:['部長/申請人','副會長/秘書長','會長','財務長'],receipt:false,midLabel:'',
    rule:'單號規則　年度＋部門代碼＋L＋流水號2碼'},
  REFUND:{label:'退費申請單',layout:'refund',header:'',version:'20260901',
    roles:[],receipt:false,midLabel:'',
    rule:'退費單號由財務長編配後填入'},
  GENERAL:{label:'一般核銷（計劃支出 P／行政支出 A）',layout:'general',header:'',version:'20260901',
    roles:['部長','副會長','會長','財務長'],receipt:false,midLabel:'已代收金額',
    rule:'單號規則　年度＋部門代碼＋支出別（A/P）＋流水號2碼'},
  PE:{label:'SCOPE 專業交換（PE）',layout:'exchange',header:'SCOPE招待費',version:'20260901',
    dept:'SCOPE',budgetCode:'IA1105',code:'PE',
    roles:['LO','NO','財務長'],receipt:false,midLabel:'已預收金額',
    rule:'單號規則　年度＋PE＋支出別（A/P）＋流水號'},
  RE:{label:'SCORE 研究交換（RE）',layout:'exchange',header:'SCORE招待費',version:'20260901',
    dept:'SCORE',budgetCode:'IA1106',code:'RE',
    roles:['LO','NO','財務長'],receipt:false,midLabel:'已預收金額',
    rule:'單號規則　年度＋RE＋支出別（A/P）＋流水號'}
};

const EXP_CATS=['國內交通費','國內住宿費','工作日餐費','醫院實習費','雜費及其他出遊活動'];

let formType='', cfg=null, passbookData='', sigData='';
let BLANK_MODE=false;
let EDIT_MODE=false;
const $=id=>document.getElementById(id);
const nf=n=>'NT$ '+(Number(n)||0).toLocaleString('en-US');
const money=n=>(n===''||n===null||n===undefined)?'':Number(n||0).toLocaleString('en-US');

function chooseType(t){
  EDIT_MODE=false;
  const oldTag=$('editBadge'); if(oldTag) oldTag.remove();
  formType=t; cfg=FORMS[t];
  $('chooser').style.display='none';
  $('form').style.display='block';
  $('bar').style.display='block';
  const fam=cfg.layout==='advance'?['預支','adv']
           :cfg.layout==='refund'?['退費','ref']:['核銷','clr'];
  $('famTag').textContent=fam[0];
  $('famTag').className='fam '+fam[1];
  $('typeNow').textContent=cfg.label;
  $('typeRule').textContent=cfg.rule;
  const adv=cfg.layout==='advance';
  const ref=cfg.layout==='refund';
  const norm=!adv&&!ref;
  $('title').textContent=adv?(cfg.advG?'經費預支單':'預支單'):ref?'退費申請單'
    :(cfg.layout==='general'?'核銷封面（一般）':'核銷封面');
  if(adv){
    const g=!!cfg.advG;
    $('advSecLabel').textContent=g?'經費預支單':'預支單';
    $('lblAdminUse').textContent=g?'計畫名稱或行政用途':'行政用途';
    $('lblLoNameA').textContent=g?'姓名':'LO姓名';
    $('lblDeptA').textContent=g?'部門職稱':'部門';
    $('boxLoSchoolA').style.display=g?'none':'block';
  }
  $('secAdvance').style.display=adv?'block':'none';
  $('secRefund').style.display=ref?'block':'none';
  $('secRefundList').style.display='none';
  $('secGeneral').style.display=cfg.layout==='general'?'block':'none';
  $('secExchange').style.display=cfg.layout==='exchange'?'block':'none';
  $('secIC').style.display=cfg.layout==='exchange'?'block':'none';
  document.body.classList.toggle('has-cat',cfg.layout==='exchange');
  if(cfg.layout==='exchange'&&!$('icBody').children.length){ addICRow(); }
  $('secItems').style.display=norm?'block':'none';
  $('secAmount').style.display=norm?'block':'none';
  $('secReceipt').style.display=norm?'block':'none';
  if(ref){ onRefundMode(); }
  document.body.classList.toggle('receipt-optional',!cfg.receipt);
  if(cfg.layout==='exchange'){
    $('budgetCode').value=cfg.budgetCode||'';
    $('budgetCode').readOnly=true;
    $('dept').value=cfg.dept||'';
    onKind();
  }
  $('midLabel').textContent=cfg.midLabel;
  $('midWord').textContent=cfg.midLabel.replace('金額','');
  if(!$('itemsBody').children.length){$('voucherCount').value=2;syncRows();}
  calc();
  window.scrollTo({top:0});

  const p=draftInfo();
  if(p){
    setStatus('偵測到 '+new Date(p.t).toLocaleString('zh-TW')+' 的暫存，可按「載入暫存」還原','ok-msg');
  }
}
function backToChooser(){
  if(!confirm('更換類別會清除目前填寫的內容，確定嗎？'))return;
  hardReset();
  $('form').style.display='none';
  $('bar').style.display='none';
  $('chooser').style.display='block';
  window.scrollTo({top:0});
}

function markPicked(input,name,onClear){
  input.style.display='none';
  let box=input.parentElement.querySelector('.filepick');
  if(!box){
    box=document.createElement('div');
    box.className='filepick';
    input.parentElement.insertBefore(box,input.nextSibling);
  }
  box.innerHTML='<span class="fn" title="'+esc(name)+'">'+esc(name)+'</span>';
  const b=document.createElement('button');
  b.type='button'; b.textContent='更換';
  b.onclick=()=>{
    input.value=''; input.style.display=''; box.remove();
    if(onClear) onClear();
  };
  box.appendChild(b);
}

/** 需要時才載入的外部函式庫，載過就不重載 */
const _scripts={};
function loadScriptOnce(src){
  if(_scripts[src]) return _scripts[src];
  _scripts[src]=new Promise((res,rej)=>{
    const el=document.createElement('script');
    el.src=src;
    el.onload=()=>res();
    el.onerror=()=>{ delete _scripts[src]; rej(new Error('元件載入失敗，請確認網路')); };
    document.head.appendChild(el);
  });
  return _scripts[src];
}

/**
 * iPhone 的 HEIC：Safari 解得開，Chrome／Edge 不行。
 * 遇到時才載入解碼器轉成 JPEG，使用者不必自己先轉檔。
 */
async function heicToFile(file){return HEIC.convert(file);}

/**
 * 讀圖。一定要處理失敗，否則瀏覽器解不開的格式
 * 會既不成功也不報錯，畫面就永遠停在「處理中…」。
 */
async function loadImage(file){
  if(/\.(heic|heif)$/i.test((file&&file.name)||'')){
    try{
      file=await heicToFile(file);
    }catch(e){
      throw new Error('HEIC 轉檔失敗（'+e.message+'）。可先用預覽程式轉存成 JPEG');
    }
  }
  return loadImageRaw(file);
}

function loadImageRaw(file){
  return new Promise((res,rej)=>{
    const name=(file&&file.name)||'';
    const timer=setTimeout(()=>rej(new Error('讀取逾時，可能是不支援的圖片格式')),30000);
    const done=fn=>(...a)=>{ clearTimeout(timer); fn(...a); };
    const ok=done(res), bad=done(rej);
    const r=new FileReader();
    r.onerror=()=>bad(new Error('檔案讀取失敗'));
    r.onload=e=>{
      const i=new Image();
      i.onload=()=>ok(i);
      i.onerror=()=>bad(new Error('這個圖片格式瀏覽器打不開（'+(name||'未知檔名')+'），請改用 JPG 或 PNG'));
      i.src=e.target.result;
    };
    r.readAsDataURL(file);
  });
}
function downscale(file){
  return loadImage(file).then(img=>{
    const maxW=1200; let w=img.width,h=img.height;
    if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
    const c=document.createElement('canvas');c.width=w;c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    return c.toDataURL('image/jpeg',0.7);
  });
}
function cropContent(img,thr){
  thr=thr||235;
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
  const g=c.getContext('2d');g.drawImage(img,0,0);
  const d=g.getImageData(0,0,c.width,c.height).data;
  let x0=c.width,y0=c.height,x1=0,y1=0,found=false;
  for(let y=0;y<c.height;y++){
    for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;
      if(d[i+3]>40&&(d[i]<thr||d[i+1]<thr||d[i+2]<thr)){
        found=true;
        if(x<x0)x0=x; if(x>x1)x1=x;
        if(y<y0)y0=y; if(y>y1)y1=y;
      }
    }
  }
  if(!found){x0=0;y0=0;x1=c.width-1;y1=c.height-1;}
  const pad=Math.round(Math.max(x1-x0,y1-y0)*0.03);
  x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);
  x1=Math.min(c.width-1,x1+pad);y1=Math.min(c.height-1,y1+pad);
  const w=x1-x0+1,h=y1-y0+1;
  let s=1; if(Math.max(w,h)>900) s=900/Math.max(w,h);
  const o=document.createElement('canvas');
  o.width=Math.round(w*s);o.height=Math.round(h*s);
  o.getContext('2d').drawImage(c,x0,y0,w,h,0,0,o.width,o.height);
  return o;
}
function frameCover(img){
  const W=1200,H=800;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
  const s=Math.min(W/img.width,H/img.height);
  g.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s);
  return c.toDataURL('image/jpeg',0.72);
}
async function pickPassbook(input){
  const f=input.files[0]; if(!f)return;
  setStatus(/\.(heic|heif)$/i.test(f.name||'')?'HEIC 轉檔中，約需數秒…':'處理存摺封面…','');
  try{
    const img=await loadImage(f);
    if(img.height>img.width) setStatus('存摺封面為直式，建議轉成橫式再上傳','err-msg');
    else setStatus('');
    passbookData=frameCover(cropContent(img));
    const p=$('passbookPrev');p.src=passbookData;p.classList.add('show');
    markPicked(input,f.name,()=>{passbookData='';p.classList.remove('show');});
  }catch(err){
    input.value='';
    setStatus('存摺封面讀取失敗：'+err.message,'err-msg');
  }
}
async function pickSig(input){
  const f=input.files[0]; if(!f)return;
  setStatus(/\.(heic|heif)$/i.test(f.name||'')?'HEIC 轉檔中，約需數秒…':'處理簽章…','');
  try{
    const img=await loadImage(f);
    sigData=cropContent(img).toDataURL('image/png');
    const p=$('sigPrev');p.src=sigData;p.classList.add('show');
    markPicked(input,f.name,()=>{sigData='';p.classList.remove('show');});
    setStatus('簽章已裁邊，列印時統一為固定尺寸','ok-msg');
  }catch(err){
    input.value='';
    setStatus('簽章讀取失敗：'+err.message,'err-msg');
  }
}
/**
 * 憑證可以是圖片，也可以是 PDF（例如電子登機證）。
 * PDF 會逐頁轉成影像，之後的列印、上傳、重送帶回都跟圖片一樣處理。
 */
async function fileToImages(file){
  const isPdf = (file.type==='application/pdf') || /\.pdf$/i.test(file.name||'');
  if(!isPdf) return [await downscale(file)];
  if(typeof pdfjsLib==='undefined') throw new Error('PDF 元件未載入，請重新整理頁面');
  pdfjsLib.GlobalWorkerOptions.workerSrc=
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc=await pdfjsLib.getDocument({isEvalSupported:false,data:new Uint8Array(await file.arrayBuffer())}).promise;
  const out=[];
  for(let p=1;p<=doc.numPages;p++){
    const page=await doc.getPage(p);
    const base=page.getViewport({scale:1});
    const vp=page.getViewport({scale:Math.min(2,1200/base.width)});
    const c=document.createElement('canvas');
    c.width=Math.round(vp.width); c.height=Math.round(vp.height);
    const g=c.getContext('2d');
    g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);
    await page.render({canvasContext:g,viewport:vp}).promise;
    out.push(c.toDataURL('image/jpeg',0.72));
  }
  return out;
}

async function pickReceipt(input){
  const f=input.files[0]; if(!f)return;
  const tr=input.closest('tr');
  const box=tr.querySelector('.thumb-box');
  box.textContent=/\.(heic|heif)$/i.test(f.name||'')?'轉檔中…':'處理中…';
  try{
    const imgs=await fileToImages(f);
    const isPdf=(f.type==='application/pdf')||/\.pdf$/i.test(f.name||'');
    tr.dataset.img=imgs[0];
    tr.dataset.imgs=JSON.stringify(imgs);
    if(isPdf) tr.dataset.pdf='1'; else delete tr.dataset.pdf;
    box.innerHTML='<img class="thumb" src="'+imgs[0]+'">'
      +(imgs.length>1?'<div class="pgs">'+imgs.length+' 頁</div>':'');
    markPicked(input,f.name,()=>{
      delete tr.dataset.img; delete tr.dataset.imgs; delete tr.dataset.pdf;
      box.innerHTML='';
    });
    if(isPdf) setStatus('PDF 已轉入 '+imgs.length+' 頁，每頁會單獨占一頁、寬度撐滿 A4','ok-msg');
  }catch(err){
    box.innerHTML=''; input.value='';
    setStatus('憑證讀取失敗：'+err.message,'err-msg');
  }
}

function addRow(){
  addRowSilent();
  $('voucherCount').value=document.querySelectorAll('#itemsBody tr').length;
  calc();
}

function syncRows(){
  const want=Math.max(0,Math.floor(Number($('voucherCount').value)||0));
  let rows=[...document.querySelectorAll('#itemsBody tr')];
  while(rows.length<want){ addRowSilent(); rows=[...document.querySelectorAll('#itemsBody tr')]; }
  let removed=0,blocked=0;
  while(rows.length>want){
    const last=rows[rows.length-1];
    const c=last.querySelectorAll('input');
    const empty=!c[2].value.trim()&&!c[3].value.trim()&&!c[4].value.trim()&&!last.dataset.img;
    if(!empty){blocked++;break;}
    last.remove(); removed++;
    rows=[...document.querySelectorAll('#itemsBody tr')];
  }
  calc();
  $('vcHint').textContent = blocked
    ? '已填寫的列不會被自動刪除，請先清空該列再調整張數' : '';
}
function addRowSilent(){
  const tr=document.createElement('tr');
  const last=document.querySelector('#itemsBody tr:last-child input');
  const lastCode=last?last.value:'';
  tr.innerHTML=`
    <td class="idx"><span class="grip" title="按住拖動可調整順序">⠿</span><span class="no"></span></td>
    <td><input value="${esc(lastCode)}"></td>
    <td class="catcol"><select class="cat"><option value=""></option>${EXP_CATS.map(v=>'<option>'+v+'</option>').join('')}</select></td>
    <td><input class="vno" readonly></td>
    <td><input></td>
    <td><input></td>
    <td class="amt"><input type="number" min="0" oninput="calc()"></td>
    <td class="amt mmcol"><input class="wmm" type="number" min="0" step="1" placeholder="自動"></td>
    <td class="file"><input type="file" accept="image/*,.heic,.heif,.hif,application/pdf" onchange="pickReceipt(this)"><div class="thumb-box"></div></td>
    <td class="del"><button class="row-del" onclick="this.closest('tr').remove();calc()">✕</button></td>`;
  $('itemsBody').appendChild(tr);
}

function addICRow(){
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td class="idx"><span class="grip" title="按住拖動可調整順序">⠿</span><span class="no"></span></td>
    <td><input placeholder="IC 姓名"></td>
    <td class="del"><button class="row-del" onclick="this.closest('tr').remove();calcIC()">✕</button></td>`;
  $('icBody').appendChild(tr);
  calcIC();
}

function calcIC(){
  const rows=[...document.querySelectorAll('#icBody tr')];
  rows.forEach((tr,i)=>{ tr.querySelector('.no').textContent=i+1; });
  const n=rows.filter(tr=>tr.querySelector('input').value.trim()).length;
  $('icCount').textContent=n+' 人';
  return n;
}

function collectICs(){
  return [...document.querySelectorAll('#icBody tr')]
    .map(tr=>tr.querySelector('input').value.trim())
    .filter(v=>v);
}

function toggleMm(){
  document.body.classList.toggle('show-mm', $('showMm').checked);
}

function refundMode(){
  return (document.querySelector('input[name=rm]:checked')||{}).value||'';
}
function onRefundMode(){
  const m=refundMode();
  const many=(m==='分別退給報名者');
  $('secRefundList').style.display=many?'block':'none';
  $('rmTotalBox').style.display=(m&&!many)?'grid':'none';
  $('secReceipt').style.display='none';
  $('secItems').style.display='none';
  $('secAmount').style.display='none';
  $('rmHint').textContent = m
    ? (many?'請在下方逐筆填寫報名者的退款帳戶；存摺封面會另起黏貼頁。'
           :'只需填寫下方「帳戶資料」一組，款項整筆退給負責幹部。')
    : '';
  if(many&&!$('refundBody').children.length){ addRefundRow(); addRefundRow(); }
  calcRefund();
}

function addRefundRow(){
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td class="idx"><span class="grip" title="按住拖動可調整順序">⠿</span><span class="no"></span></td>
    <td><input></td>
    <td class="amt"><input type="number" min="0" oninput="calcRefund()"></td>
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td class="file"><input type="file" accept="image/*" onchange="pickRefundPassbook(this)"><div class="thumb-box"></div></td>
    <td class="del"><button class="row-del" onclick="this.closest('tr').remove();calcRefund()">✕</button></td>`;
  $('refundBody').appendChild(tr);
  calcRefund();
}

async function pickRefundPassbook(input){
  const f=input.files[0]; if(!f)return;
  const tr=input.closest('tr');
  const box=tr.querySelector('.thumb-box');
  box.textContent=/\.(heic|heif)$/i.test(f.name||'')?'轉檔中…':'處理中…';
  try{
    const img=await loadImage(f);
    const d=frameCover(cropContent(img));
    tr.dataset.img=d;
    box.innerHTML='<img class="thumb" src="'+d+'">';
    markPicked(input,f.name,()=>{delete tr.dataset.img;box.innerHTML='';});
  }catch(err){
    box.innerHTML=''; input.value='';
    setStatus('存摺封面讀取失敗：'+err.message,'err-msg');
  }
}

function calcRefund(){
  let total=0;
  document.querySelectorAll('#refundBody tr').forEach((tr,i)=>{
    tr.querySelector('.no').textContent=i+1;
    total+=Number(tr.querySelector('.amt input').value)||0;
  });
  $('refundTotal').textContent=nf(total);
  return total;
}

function collectRefunds(){
  return [...document.querySelectorAll('#refundBody tr')].map(tr=>{
    const c=tr.querySelectorAll('input');
    return {name:c[0].value,amt:c[1].value,bank:c[2].value,bankCode:c[3].value,
            branch:c[4].value,branchCode:c[5].value,acctNo:c[6].value,acctName:c[7].value,
            passbook:tr.dataset.img||''};
  }).filter(r=>r.name||r.amt);
}

let dragRow=null;
function clearMarks(){
  document.querySelectorAll('#itemsBody tr').forEach(t=>t.classList.remove('drop-before','drop-after'));
}
function finishDrag(){
  if(dragRow){ dragRow.classList.remove('dragging'); dragRow.draggable=false; }
  dragRow=null; clearMarks(); calc(); scheduleAutoSave();
}
function initDrag(){
  const body=$('itemsBody');
  body.addEventListener('mousedown',e=>{
    const g=e.target.closest('.grip');
    if(g) g.closest('tr').draggable=true;
  });
  body.addEventListener('mouseup',e=>{
    if(!dragRow) document.querySelectorAll('#itemsBody tr').forEach(t=>t.draggable=false);
  });
  body.addEventListener('dragstart',e=>{
    const tr=e.target.closest('tr'); if(!tr) return;
    dragRow=tr; tr.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
    try{ e.dataTransfer.setData('text/plain','row'); }catch(_){}
  });
  body.addEventListener('dragover',e=>{
    if(!dragRow) return;
    e.preventDefault();
    const tr=e.target.closest('tr');
    if(!tr||tr===dragRow) return;
    clearMarks();
    const r=tr.getBoundingClientRect();
    tr.classList.add((e.clientY-r.top)<r.height/2?'drop-before':'drop-after');
  });
  body.addEventListener('drop',e=>{
    e.preventDefault();
    if(!dragRow){ return; }
    const tr=e.target.closest('tr');
    if(tr&&tr!==dragRow){
      const r=tr.getBoundingClientRect();
      const before=(e.clientY-r.top)<r.height/2;
      body.insertBefore(dragRow, before?tr:tr.nextSibling);
    }
    finishDrag();
  });
  body.addEventListener('dragend',finishDrag);
}

function calc(){
  let total=0;
  document.querySelectorAll('#itemsBody tr').forEach((tr,i)=>{
    tr.querySelector('.no').textContent=i+1;
    tr.querySelector('.vno').value=i+1;
    total+=Number(tr.querySelector('.amt input').value)||0;
  });
  $('grandTotal').textContent=nf(total);
  const drawn=Number($('advanceDrawn').value)||0;
  const prepaid=Number($('prepaid').value)||0;
  const oop=Number($('outOfPocket').value)||0;
  const diff=(drawn+prepaid)-oop;
  $('settleAmt').textContent=nf(Math.abs(diff));
  const tag=$('sResult');
  if(diff>0){tag.textContent='剩餘（＋）應匯回本會';tag.className='tag ok';}
  else if(diff<0){tag.textContent='請款（－）本會應撥付';tag.className='tag warn';}
  else{tag.textContent='結清';tag.className='tag ok';}
}

const ZH_NUM=['零','壹','貳','參','肆','伍','陸','柒','捌','玖'];
const ZH_UNIT=['','拾','佰','仟'];
const ZH_BIG=['','萬','億'];
function toZh(n){
  n=Math.floor(Math.abs(Number(n)||0));
  if(n===0) return '零';
  let s='',gi=0;
  while(n>0){
    const g=n%10000;
    if(g>0){
      let gs='',zero=false,x=g,pos=0;
      while(x>0){
        const d=x%10;
        if(d===0){ if(gs) zero=true; }
        else{ gs=ZH_NUM[d]+ZH_UNIT[pos]+(zero?'零':'')+gs; zero=false; }
        x=Math.floor(x/10); pos++;
      }
      s=gs+ZH_BIG[gi]+s;
    }else if(s&&!s.startsWith('零')){ s='零'+s; }
    n=Math.floor(n/10000); gi++;
  }
  return s;
}
function calcZh(){ $('payeeAmtZh').textContent='合計新台幣　'+toZh($('payeeAmt').value)+'元整'; }
function toggleAddr(){
  const same=$('addrSame').checked;
  $('addr2').disabled=same;
  if(same) $('addr2').value='';
}
function onExpenseType(){
  const v=(document.querySelector('input[name=et]:checked')||{}).value||'';
  $('boxP').style.display=v==='P'?'grid':'none';
  $('boxA').style.display=v==='A'?'block':'none';
}
function onKind(){
  if(!cfg||cfg.layout!=='exchange')return;
  const opt=$('kind').selectedOptions[0];
  const et=opt?(opt.dataset.et||''):'';
  $('typeRule').textContent = et
    ? '單號規則　'+'115'+cfg.code+et+'01　（'+(et==='A'?'行政支出':'計劃支出')+'）'
    : cfg.rule;
}
function onAdminType(){
  const v=(document.querySelector('input[name=at]:checked')||{}).value||'';
  $('boxAOther').style.display=v==='其他行政支出'?'grid':'none';
}

function val(id){ const e=$(id); return e?e.value.trim():''; }
function collect(){
  const items=[...document.querySelectorAll('#itemsBody tr')].map((tr,i)=>{
    const c=tr.querySelectorAll('input');
    const sel=tr.querySelector('select.cat');
    let imgs=[];
    try{ imgs=JSON.parse(tr.dataset.imgs||'[]'); }catch(_){ imgs=[]; }
    if(!imgs.length && tr.dataset.img) imgs=[tr.dataset.img];
    return {code:c[0].value,cat:sel?sel.value:'',vno:c[1].value||String(i+1),
            item:c[2].value,use:c[3].value,
            amt:c[4].value,widthMm:Number(c[5].value)||0,
            img:imgs[0]||'',imgs:imgs,pdf:(tr.dataset.pdf==='1')};
  }).filter(it=>it.item||it.amt||it.img);

  const general=cfg.layout==='general';
  const adv=cfg.layout==='advance';
  const ref=cfg.layout==='refund';
  const at=(document.querySelector('input[name=at]:checked')||{}).value||'';
  let et='';
  if(general){
    et=(document.querySelector('input[name=et]:checked')||{}).value||'';
  }else{
    const opt=$('kind').selectedOptions[0];
    et=opt?(opt.dataset.et||''):'';
  }

  return {
    formType:formType, type:'settle',
    expenseType:et, projectName:general?val('projectName'):'',
    adminType:general?(at==='其他行政支出'?('其他行政支出：'+val('adminOther')):at):'',
    deptTitle:general?val('deptTitle'):'',
    kind:(general||adv)?'':val('kind'),
    budgetCode:adv?'':(general?val('budgetCodeG'):val('budgetCode')),
    dept:adv?val('deptA'):ref?val('deptR'):(general?val('deptTitle'):val('dept')),
    docNo:adv?val('docNoA'):ref?val('docNoR'):(general?val('docNoG'):val('docNo')),
    staffName:ref?val('staffR'):(general?val('staffName'):''),
    fileDate:ref?val('fileDateR'):val('fileDate'),
    loName:adv?val('loNameA'):(general?'':val('loName')),
    loSchool:adv?val('loSchoolA'):(general?'':val('loSchool')),
    adminUse:adv?val('adminUse'):'', planCode:adv?val('planCode'):'',
    phone2:adv?val('phone2'):(ref?val('phoneR'):''),
    advanceAmount:adv?val('advanceAmount'):'',
    eventName:ref?val('eventName'):'', refundReason:ref?val('refundReason'):'',
    refundMode:ref?refundMode():'', refunds:ref?collectRefunds():[],
    refundTotal:ref?(refundMode()==='分別退給報名者'?calcRefund():Number(val('refundTotalInput'))||0):0,
    acctName:val('acctName'), acctNo:val('acctNo'),
    bank:val('bank'), bankCode:val('bankCode'), branch:val('branch'),
    passbook:passbookData,
    budgetName:general?val('budgetNameG'):val('budgetName'),
    voucherCount:Number(val('voucherCount'))||0,
    advanceDrawn:val('advanceDrawn'), advanceNo:val('advanceNo'),
    prepaid:val('prepaid'), outOfPocket:val('outOfPocket'),
    payeeName:val('payeeName'), payeeId:val('payeeId'), payeeReason:val('payeeReason'),
    payeeAmt:val('payeeAmt'), payeeAmtZh:toZh(val('payeeAmt')),
    addr1:val('addr1'), addrSame:$('addrSame').checked, addr2:val('addr2'),
    phone:val('phone'), payeeDate:val('payeeDate'),
    isEdit:EDIT_MODE,
    ics:(cfg.layout==='exchange'?collectICs():[]),
    signature:sigData, items:items
  };
}

function setStatus(msg,c){ const s=$('status'); s.textContent=msg; s.className=c||''; }

function draftKey(){ return 'fmstw_expense_draft_'+formType; }

function saveDraft(silent){
  try{
    const payload={t:Date.now(), d:collect()};
    localStorage.setItem(draftKey(), JSON.stringify(payload));
    if(!silent) setStatus('已暫存於這台電腦的瀏覽器　'+new Date().toLocaleString('zh-TW'),'ok-msg');
    return true;
  }catch(e){
    if(!silent) setStatus('暫存失敗（可能是圖片太多超出瀏覽器容量）：'+e.message,'err-msg');
    return false;
  }
}

function draftInfo(){
  try{
    const raw=localStorage.getItem(draftKey());
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

function loadDraft(){
  const p=draftInfo();
  if(!p){ setStatus('這個類別目前沒有暫存資料','err-msg'); return; }
  if(!confirm('載入 '+new Date(p.t).toLocaleString('zh-TW')+' 的暫存？目前填寫的內容會被取代。')) return;
  applyData(p.d);
  setStatus('已載入暫存','ok-msg');
}

function clearDraft(){
  try{ localStorage.removeItem(draftKey()); }catch(e){}
}

function applyData(d){
  if(d.isEdit) EDIT_MODE=true;
  const set=(id,v)=>{ const e=$(id); if(e) e.value=(v==null?'':v); };
  set('projectName',d.projectName); set('deptTitle',d.deptTitle); set('staffName',d.staffName);
  set('budgetCodeG',d.budgetCode); set('docNoG',d.docNo); set('budgetNameG',d.budgetName);
  set('kind',d.kind); set('budgetCode',d.budgetCode); set('dept',d.dept);
  set('docNo',d.docNo); set('loName',d.loName); set('loSchool',d.loSchool);
  set('budgetName',d.budgetName);
  set('acctName',d.acctName); set('acctNo',d.acctNo);
  set('bank',d.bank); set('bankCode',d.bankCode); set('branch',d.branch);
  set('fileDate',d.fileDate);
  set('advanceDrawn',d.advanceDrawn); set('advanceNo',d.advanceNo);
  set('prepaid',d.prepaid); set('outOfPocket',d.outOfPocket);
  set('payeeName',d.payeeName); set('payeeId',d.payeeId); set('payeeReason',d.payeeReason);
  set('payeeAmt',d.payeeAmt); set('addr1',d.addr1); set('addr2',d.addr2);
  set('phone',d.phone); set('payeeDate',d.payeeDate);

  if(d.expenseType){
    const r=document.querySelector('input[name=et][value="'+d.expenseType+'"]');
    if(r){r.checked=true;onExpenseType();}
  }
  if(d.adminType){
    const isOther=String(d.adminType).indexOf('其他行政支出')===0;
    const r=document.querySelector('input[name=at][value="'+(isOther?'其他行政支出':'幹部工作費')+'"]');
    if(r){r.checked=true;onAdminType();}
    if(isOther) set('adminOther',String(d.adminType).replace('其他行政支出：',''));
  }
  // 預支單
  set('docNoA',d.docNo); set('adminUse',d.adminUse); set('advanceAmount',d.advanceAmount);
  set('planCode',d.planCode); set('loNameA',d.loName); set('loSchoolA',d.loSchool);
  set('phone2',d.phone2); set('deptA',d.dept);
  // 退費單
  set('docNoR',d.docNo); set('eventName',d.eventName); set('refundReason',d.refundReason);
  set('deptR',d.dept); set('staffR',d.staffName); set('phoneR',d.phone2);
  set('fileDateR',d.fileDate); set('refundTotalInput',d.refundTotal);
  if(d.refundMode){
    const r=document.querySelector('input[name=rm][value="'+d.refundMode+'"]');
    if(r){ r.checked=true; onRefundMode(); }
  }
  if((d.refunds||[]).length){
    $('refundBody').innerHTML='';
    d.refunds.forEach(rf=>{
      addRefundRow();
      const tr=$('refundBody').lastElementChild;
      const c=tr.querySelectorAll('input');
      c[0].value=rf.name||''; c[1].value=rf.amt||''; c[2].value=rf.bank||'';
      c[3].value=rf.bankCode||''; c[4].value=rf.branch||''; c[5].value=rf.branchCode||'';
      c[6].value=rf.acctNo||''; c[7].value=rf.acctName||'';
      if(rf.passbook){
        tr.dataset.img=rf.passbook;
        tr.querySelector('.thumb-box').innerHTML='<img class="thumb" src="'+rf.passbook+'">';
      }
    });
    calcRefund();
  }

  $('addrSame').checked=(d.addrSame!==false);
  toggleAddr();

  passbookData=d.passbook||'';
  if(passbookData){const p=$('passbookPrev');p.src=passbookData;p.classList.add('show');}
  sigData=d.signature||'';
  if(sigData){const p=$('sigPrev');p.src=sigData;p.classList.add('show');}

  $('icBody').innerHTML='';
  (d.ics||[]).forEach(name=>{ addICRow(); $('icBody').lastElementChild.querySelector('input').value=name; });
  calcIC();

  $('itemsBody').innerHTML='';
  (d.items||[]).forEach(it=>{
    addRowSilent();
    const tr=$('itemsBody').lastElementChild;
    const c=tr.querySelectorAll('input');
    c[0].value=it.code||''; c[2].value=it.item||''; c[3].value=it.use||'';
    c[4].value=it.amt||''; c[5].value=it.widthMm||'';
    const sel=tr.querySelector('select.cat'); if(sel) sel.value=it.cat||'';
    const imgs=(it.imgs&&it.imgs.length)?it.imgs:(it.img?[it.img]:[]);
    if(imgs.length){
      tr.dataset.img=imgs[0];
      tr.dataset.imgs=JSON.stringify(imgs);
      if(it.pdf) tr.dataset.pdf='1';
      tr.querySelector('.thumb-box').innerHTML='<img class="thumb" src="'+imgs[0]+'">'
        +(imgs.length>1?'<div class="pgs">'+imgs.length+' 頁</div>':'');
    }
  });
  $('voucherCount').value=(d.items||[]).length;
  calcZh(); calc();
}

let autoTimer=null;
function scheduleAutoSave(){
  if(!formType) return;
  clearTimeout(autoTimer);
  autoTimer=setTimeout(()=>saveDraft(true),2000);
}
document.addEventListener('input',e=>{
  if(e.target.closest('#icBody')) calcIC();
  if(e.target.closest('#form')) scheduleAutoSave();
});
document.addEventListener('change',e=>{ if(e.target.closest('#form')) scheduleAutoSave(); });
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function rocDate(s){
  const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return '中華民國　　年　　月　　日';
  return '中華民國 '+(+m[1]-1911)+' 年 '+(+m[2])+' 月 '+(+m[3])+' 日';
}

function renderAdvance(d){
  const roles=cfg.roles||[];
  const colW=(100/Math.max(roles.length,1)).toFixed(4)+'%';
  const sigTable='<table class="sigtab"><colgroup>'
    +roles.map(()=>'<col style="width:'+colW+'">').join('')+'</colgroup>'
    +'<tr class="sighd">'+roles.map(r=>'<td class="ctr">'+esc(r)+'</td>').join('')+'</tr>'
    +'<tr class="sigrow">'+roles.map(()=>'<td></td>').join('')+'</tr></table>';

  const passbook=d.passbook?'<img class="pasteimg" src="'+d.passbook+'">'
    :'<div class="note red">（存摺封面影本）</div>';

  /* 兩種預支單的封面欄位、簽核鏈與注意事項不同 */
  const advG=!!cfg.advG;
  const notes = advG
    ? ['最遲請在活動開始前一週填寫本「經費預支單」並簽名後送交財務長。',
       '計畫預支請先經副會長／秘書長簽名後，再送交財務長憑辦。',
       '財務長收到請款單後三個工作天內依照金額數匯入指定帳戶，匯款完畢儘速通知。',
       '經費申請人刷摺確認收到帳款後回覆，即完成預支手續。',
       '計劃預支原則以預算之 80％ 為上限，特殊狀況請事先尋求財務長同意。']
    : ['最遲請在活動開始前一週填寫本「經費預支單」並簽名後送交財務長。',
       '請先經 NO 簽名後，再送交財務長憑辦。',
       '財務長收到請款單後三個工作天內依照金額數匯入指定帳戶，匯款完畢儘速通知。',
       '經費申請人刷摺確認收到帳款後回覆，即完成預支手續。'];
  const noteList=notes.map(t=>'<li><span class="txt">'+t+'</span></li>').join('');

  /* 經費預支單：單號印在表格右上，欄位是姓名／部門職稱，沒有 LO 欄 */
  const advNo = advG
    ? '<div class="advno">預支單編號：'
      +(String(d.docNo||'').trim() ? esc(d.docNo) : '年度＋部門代碼＋L＋流水號2碼')+'</div>'
    : '';
  const advRows = advG ? `
      <tr><td class="ctr">計畫名稱或行政用途</td><td colspan="3">${esc(d.adminUse)}</td></tr>
      <tr><td class="ctr">預支金額</td><td>${money(d.advanceAmount)}</td>
          <td class="ctr">計畫編號</td><td>${esc(d.planCode)}</td></tr>
      <tr><td class="ctr">姓名</td><td>${esc(d.loName)}</td>
          <td class="ctr">部門職稱</td><td>${esc(d.dept)}</td></tr>
      <tr><td class="ctr">連絡電話</td><td colspan="3">${esc(d.phone2)}</td></tr>` : `
      <tr><td class="ctr">行政用途</td><td>${esc(d.adminUse)}</td>
          <td class="ctr">預支單號</td><td>${esc(d.docNo)}</td></tr>
      <tr><td class="ctr">預支金額</td><td>${money(d.advanceAmount)}</td>
          <td class="ctr">計畫編號</td><td>${esc(d.planCode)}</td></tr>
      <tr><td class="ctr">LO 姓名</td><td>${esc(d.loName)}</td>
          <td class="ctr">LO 學校</td><td>${esc(d.loSchool)}</td></tr>
      <tr><td class="ctr">連絡電話</td><td>${esc(d.phone2)}</td>
          <td class="ctr">部門</td><td>${esc(d.dept)}</td></tr>`;

  $('pvBody').innerHTML=`
  <div class="page">
    ${advNo}
    <div class="org"${advG?'':' style="margin-top:6mm"'}>社團法人台灣醫學生聯合會</div>
    <div class="advhead">
      <span class="advtitle">預支單</span>
      <span class="advdate">${esc(rocDate(d.fileDate))}</span>
    </div>
    <table class="cover">
      <colgroup><col style="width:34mm"><col style="width:46mm">
        <col style="width:28mm"><col></colgroup>
      ${advRows}
      <tr><td class="ctr">帳戶資料</td>
        <td colspan="3" class="nopad">
          <table class="acct">
            <colgroup><col style="width:24mm"><col><col style="width:16mm">
              <col style="width:28mm"><col style="width:16mm"><col style="width:20mm"></colgroup>
            <tr><td class="ctr">戶名</td><td colspan="5" class="ctr">${esc(d.acctName)}</td></tr>
            <tr><td class="ctr">銀行</td><td class="ctr">${esc(d.bank)}</td>
                <td class="ctr">分行</td><td class="ctr">${esc(d.branch)}</td>
                <td class="ctr">代碼</td><td class="ctr">${esc(d.bankCode)}</td></tr>
            <tr><td class="ctr">匯款帳號</td><td colspan="5" class="ctr">${esc(d.acctNo)}</td></tr>
            <tr><td colspan="6" class="pastebox">${passbook}</td></tr>
          </table>
        </td></tr>
    </table>
    ${sigTable}
    <div class="notes">
      <div>注意事項：</div>
      <ol>${noteList}</ol>
    </div>
    <div class="pn"></div>
  </div>`;
  renumberPages();
}

function renderRefund(d){
  const many=(d.refundMode==='分別退給報名者');
  const list=d.refunds||[];
  const total=many? list.reduce((s,r)=>s+(Number(r.amt)||0),0) : Number(d.refundTotal)||0;

  let rows='';
  if(many){
    list.forEach((r,i)=>{
      rows+='<tr><td class="ctr">'+(i+1)+'</td><td>'+esc(r.name)+'</td>'
        +'<td class="rt">'+money(r.amt)+'</td>'
        +'<td>'+esc(r.bank)+(r.bankCode?'（'+esc(r.bankCode)+'）':'')+'</td>'
        +'<td>'+esc(r.branch)+(r.branchCode?'（'+esc(r.branchCode)+'）':'')+'</td>'
        +'<td>'+esc(r.acctNo)+'</td><td>'+esc(r.acctName)+'</td></tr>';
    });
  }else{
    rows='<tr><td class="ctr">1</td><td>'+esc(d.staffName)+'</td>'
      +'<td class="rt">'+money(total)+'</td>'
      +'<td>'+esc(d.bank)+(d.bankCode?'（'+esc(d.bankCode)+'）':'')+'</td>'
      +'<td>'+esc(d.branch)+'</td>'
      +'<td>'+esc(d.acctNo)+'</td><td>'+esc(d.acctName)+'</td></tr>';
  }

  let pastes='';
  if(many){
    list.filter(r=>r.passbook).forEach((r,i)=>{
      pastes+='<figure><img src="'+r.passbook+'"><figcaption>'+esc(r.name)+'</figcaption></figure>';
    });
  }else if(d.passbook){
    pastes='<figure><img src="'+d.passbook+'"><figcaption>'+esc(d.staffName)+'</figcaption></figure>';
  }
  const pastePage = pastes ? `
  <div class="page">
    <div class="rh"><span>社團法人台灣醫學生聯合會退費申請單</span><span>版次${cfg.version}</span></div>
    <div class="paste-title" style="margin-top:6px">退費帳戶存摺封面</div>
    <div class="paste-note">依退款對象順序排列。</div>
    <div class="rcpt-grid">${pastes}</div>
    <div class="pn"></div>
  </div>` : '';

  $('pvBody').innerHTML=`
  <div class="page">
    <div class="rh"><span>社團法人台灣醫學生聯合會退費申請單</span><span>版次${cfg.version}</span></div>
    <div class="org">社團法人台灣醫學生聯合會</div>
    <div class="advhead">
      <span class="advtitle" style="font-size:20pt">退費申請單</span>
      <span class="advdate">${esc(rocDate(d.fileDate))}</span>
    </div>
    <table class="cover">
      <colgroup><col style="width:28mm"><col style="width:52mm">
        <col style="width:28mm"><col></colgroup>
      <tr><td class="ctr">活動名稱</td><td>${esc(d.eventName)}</td>
          <td class="ctr">退費單號</td><td>${esc(d.docNo)}</td></tr>
      <tr><td class="ctr">退款原因</td><td colspan="3">${esc(d.refundReason)}</td></tr>
      <tr><td class="ctr">部門</td><td>${esc(d.dept)}</td>
          <td class="ctr">負責幹部</td><td>${esc(d.staffName)}</td></tr>
      <tr><td class="ctr">連絡電話</td><td>${esc(d.phone2)}</td>
          <td class="ctr">退款方式</td><td>${esc(d.refundMode)}</td></tr>
      <tr><td class="ctr">退款總金額</td><td colspan="3" class="b">${money(total)} 元</td></tr>
    </table>

    <table class="items" style="margin-top:6px">
      <colgroup><col style="width:12mm"><col style="width:24mm"><col style="width:22mm">
        <col style="width:32mm"><col style="width:28mm"><col><col style="width:24mm"></colgroup>
      <thead>
        <tr><th class="ctr">序號</th><th class="ctr">姓名</th><th class="ctr">退款金額</th>
            <th class="ctr">銀行（代碼）</th><th class="ctr">分行（代碼）</th>
            <th class="ctr">銀行帳號</th><th class="ctr">戶名</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="notes">
      <div>注意事項：</div>
      <ol>
        <li><span class="txt">款項整筆退給負責幹部時，只需填寫負責幹部的帳戶；分別退給報名者時，請逐筆填寫各報名者帳戶。</span></li>
        <li><span class="txt">活動負責幹部收到退款申請後，請主動向財務長確認退費條件和金額。</span></li>
        <li><span class="txt">負責幹部彙整退款資訊後須填妥此表格，並在活動報名截止後 7 日內於退費表單內上傳。</span></li>
        <li><span class="txt">相關退費事宜依照《社團法人台灣醫學生聯合會退費辦法》辦理。</span></li>
        <li><span class="txt">如有任何問題，請聯絡財務長信箱：treasurer@fmstw.org。</span></li>
      </ol>
    </div>
    <div class="pn"></div>
  </div>
  ${pastePage}`;
  renumberPages();
}
function renderSheets(d){
  if(cfg.layout==='refund'){ renderRefund(d); return; }
  if(cfg.layout==='advance'){ renderAdvance(d); return; }
  const items=d.items||[];
  const total=items.reduce((s,i)=>s+(Number(i.amt)||0),0);
  const drawn=Number(d.advanceDrawn)||0,prepaid=Number(d.prepaid)||0,oop=Number(d.outOfPocket)||0;
  const diff=(drawn+prepaid)-(d.claimAmount==null||d.claimAmount===''?oop:Number(d.claimAmount));
  const general=cfg.layout==='general';

  const rh='<div class="rh"><span>社團法人台灣醫學生聯合會核銷單'+(general?'':cfg.header)
    +'</span><span>版次'+cfg.version+'</span></div>';

  const passbook=d.passbook?'<img class="pasteimg" src="'+d.passbook+'">'
    :'<div class="note red">（存摺封面影本，無則免附）</div>';

  const acctBlock=`
    <tr><td class="ctr">帳戶資料</td>
      <td colspan="3" class="nopad">
        <table class="acct">
          <colgroup><col style="width:17mm"><col><col style="width:22mm">
            <col style="width:20mm"><col style="width:15mm"><col style="width:32mm"></colgroup>
          <tr><td>戶名</td><td colspan="5">${esc(d.acctName)}</td></tr>
          <tr><td>銀行</td><td>${esc(d.bank)}</td>
              <td class="ctr">銀行代碼</td><td>${esc(d.bankCode)}</td>
              <td class="ctr">分行</td><td>${esc(d.branch)}</td></tr>
          <tr><td>帳號</td><td colspan="5">${esc(d.acctNo)}</td></tr>
          <tr><td colspan="6" class="pastebox">${passbook}</td></tr>
        </table>
      </td></tr>`;

  const coverCols='<colgroup><col style="width:28mm"><col style="width:52mm">'
    +'<col style="width:28mm"><col></colgroup>';

  const amountBlock=`
    <tr><td class="b">已預支金額</td><td colspan="3" class="rt">
      ${d.advanceNo?'<span class="red">（預支單號 '+esc(d.advanceNo)+'）</span>':''}<span class="b">${money(drawn)}</span>元</td></tr>
    <tr><td class="b">${cfg.midLabel}</td><td colspan="3" class="rt"><span class="b">${money(prepaid)}</span>元</td></tr>
    <tr><td class="b">已墊付金額</td><td colspan="3" class="rt"><span class="b">${money(oop)}</span>元</td></tr>
    <tr><td class="b">本次申請核銷</td><td colspan="3" class="rt">${money(d.claimAmount==null?oop:d.claimAmount)}元</td></tr>
    <tr><td class="b">不申請核銷差額</td><td colspan="3">${money(total-Number(d.claimAmount==null?oop:d.claimAmount))}元　${esc(d.claimNote||'')}</td></tr>
    <tr><td class="b">結算金額</td><td colspan="3" class="b rt">剩餘（＋）／請款（－）<span class="red ul">${diff<0?'-':''}${money(Math.abs(diff))}</span>元</td></tr>`;

  const cover=general?`
    <table class="cover">
      ${coverCols}
      <tr><td class="ctr b" colspan="2">計劃支出（P）</td><td class="ctr b" colspan="2">行政支出（A）</td></tr>
      <tr><td colspan="2">${d.expenseType==='P'?esc(d.projectName):'<span class="red">（計劃名稱）</span>'}</td>
          <td colspan="2">${d.expenseType==='A'
            ? (String(d.adminType).indexOf('幹部工作費')===0
                ? '■幹部工作費<br>□其他行政支出<span class="fill"></span>'
                : '□幹部工作費<br>■其他行政支出<span class="fill">'+esc(String(d.adminType).replace('其他行政支出：',''))+'</span>')
            : '□幹部工作費<br>□其他行政支出<span class="fill"></span>'}</td></tr>
      <tr><td>部門職稱</td><td>${esc(d.deptTitle)}</td>
          <td>預算科目</td><td>${esc(d.budgetCode)}</td></tr>
      <tr><td>幹部姓名</td><td>${esc(d.staffName)}</td>
          <td>核銷單號</td><td>${esc(d.docNo)}</td></tr>
      <tr><td>預算名稱</td><td colspan="3">${esc(d.budgetName)}</td></tr>
      ${acctBlock}
      ${amountBlock}
    </table>
    <div class="notes">
      <div>注意事項：</div>
      <ol>
        <li><span class="txt">「行政支出」及「計劃支出」兩欄僅能擇一填寫，每份核銷單以申報一項為限。</span></li>
        <li><span class="txt">「已預支金額」請與預支單金額相符。</span></li>
        <li><span class="txt">行政核銷請按月申請；計劃核銷最晚請於活動結束後<span class="b red">一個月內</span>完成。核銷不得跨年度。</span></li>
        <li><span class="txt">核銷單請透過核銷表單上傳（內附支出憑證電子檔或照片），並將原始憑證郵寄或當面繳回（如僅有電子單據，無需紙本寄回）。</span></li>
        <li><span class="txt">核銷單號規則：年度＋部門代碼＋支出別（A/P）＋流水號2碼，範例：115EBA01。</span></li>
        <li><span class="txt b">收入請務必據實申報。結算金額如有剩餘，請填寫剩餘金額數，於兩週內匯回本會帳戶。
          <span class="cont">戶名：社團法人台灣醫學生聯合會。</span>
          <span class="cont">銀行：006-5159合作金庫銀行南門分行。帳號：5159-765-307187。</span></span></li>
        <li><span class="txt">如有任何問題，請參考報帳相關說明，或聯絡財務長信箱：treasurer@fmstw.org。</span></li>
      </ol>
    </div>`
  :`
    <table class="cover">
      ${coverCols}
      <tr><td>核銷種類</td><td>${esc(d.kind)}</td>
          <td>預算科目</td><td>${esc(d.budgetCode)}</td></tr>
      <tr><td>部門</td><td>${esc(d.dept)}</td>
          <td>核銷單號</td><td>${esc(d.docNo)}</td></tr>
      <tr><td>LO姓名</td><td>${esc(d.loName)}</td>
          <td>LO學校</td><td>${esc(d.loSchool)}</td></tr>
      <tr><td>預算名稱</td><td colspan="3">${esc(d.budgetName)}</td></tr>
      ${acctBlock}
      ${amountBlock}
    </table>
    <div class="notes">
      <div>注意事項：</div>
      <ol>
        <li><span class="txt">「已預支金額」請與預支單金額相符。</span></li>
        <li><span class="txt">行政核銷請按月申請。核銷不得跨年度。</span></li>
        <li><span class="txt">核銷單請透過核銷表單上傳（內附支出憑證電子檔或照片），並將原始憑證郵寄或當面繳回（如僅有電子單據，無需紙本寄回）。</span></li>
        <li><span class="txt">收入請務必據實申報。結算金額如有剩餘，請填寫剩餘金額數，於兩週內匯回交換部門帳戶。
          <span class="cont b">戶名：社團法人台灣醫學生聯合會。</span>
          <span class="cont b">銀行：006-5159合作金庫銀行南門分行。帳號：5159717516211。</span></span></li>
        <li><span class="txt">如有任何問題，請參考報帳相關說明，或聯絡財務長信箱：treasurer@fmstw.org。</span></li>
      </ol>
    </div>`;

  const hasCat=(cfg.layout==='exchange');
  let rows='';
  items.forEach(it=>{
    rows+='<tr><td class="ctr">'+esc(it.code)+'</td>'
      +(hasCat?'<td class="ctr">'+esc(it.cat||'')+'</td>':'')
      +'<td class="ctr">'+esc(it.vno)+'</td>'
      +'<td>'+esc(it.item)+'</td><td>'+esc(it.use)+'</td>'
      +'<td class="rt">'+money(it.amt)+'</td></tr>';
  });
  if(hasCat){
    const sums={};
    items.forEach(it=>{ const k=String(it.cat||'').trim()||'未分類';
                        sums[k]=(sums[k]||0)+(Number(it.amt)||0); });
    EXP_CATS.concat(['未分類']).filter(k=>sums[k]).forEach(k=>{
      rows+='<tr class="subt"><td class="rt" colspan="5">'+esc(k)+'　小計</td>'
        +'<td class="rt">'+money(sums[k])+'</td></tr>';
    });
  }
  const itemCols = hasCat
    ? '<colgroup><col style="width:18mm"><col style="width:26mm"><col style="width:16mm">'
      +'<col style="width:30mm"><col><col style="width:24mm"></colgroup>'
    : '<colgroup><col style="width:22mm"><col style="width:20mm"><col style="width:38mm">'
      +'<col><col style="width:26mm"></colgroup>';
  const spanN = hasCat ? 3 : 2;
  const itemTable = '<table class="items">'+itemCols+'<thead>'
    +'<tr><th class="ctr">預算科目</th><th class="ctr">憑證張數</th>'
      +'<th class="ctr" colspan="'+spanN+'">預算名稱</th><th class="ctr">支出總金額</th></tr>'
    +'<tr><th class="ctr">'+esc(d.budgetCode)+'</th><th class="ctr">'+items.length+'</th>'
      +'<th class="ctr" colspan="'+spanN+'">'+esc(d.budgetName)+'</th>'
      +'<th class="rt">'+money(total)+'</th></tr>'
    +'<tr><th class="ctr">科目編號</th>'+(hasCat?'<th class="ctr">費用類別</th>':'')
      +'<th class="ctr">憑證單號</th><th class="ctr">項目名稱</th>'
      +'<th class="ctr">用途說明</th><th class="ctr">金額</th></tr>'
    +'</thead><tbody>'+rows+'</tbody></table>';

  const roles=cfg.roles||[];
  const colW=(100/Math.max(roles.length,1)).toFixed(4)+'%';
  const sigTable='<table class="sigtab"><colgroup>'
    +roles.map(()=>'<col style="width:'+colW+'">').join('')+'</colgroup>'
    +'<tr class="sighd">'+roles.map(r=>'<td class="ctr">'+esc(r)+'</td>').join('')+'</tr>'
    +'<tr class="sigrow">'+roles.map(()=>'<td></td>').join('')+'</tr></table>';

  const icList=(d.ics||[]).filter(v=>String(v).trim());
  let icBlock='';
  if(cfg.layout==='exchange'&&(icList.length||BLANK_MODE)){
    const per=4;
    const rowsN=Math.max(icList.length, BLANK_MODE?8:0);
    let cells='';
    for(let i=0;i<rowsN;i+=per){
      cells+='<tr>';
      for(let j=0;j<per;j++){
        const k=i+j;
        cells+= k<icList.length
          ? '<td class="n">'+(k+1)+'</td><td>'+esc(icList[k])+'</td>'
          : (BLANK_MODE ? '<td class="n">'+(k+1)+'</td><td></td>'
                        : '<td class="n"></td><td></td>');
      }
      cells+='</tr>';
    }
    icBlock='<div class="ic-title">IC 名單'+(BLANK_MODE?'':'（共 '+icList.length+' 人）')+'</div>'
      +'<table class="iclist"><colgroup>'
      +'<col style="width:9mm"><col><col style="width:9mm"><col>'
      +'<col style="width:9mm"><col><col style="width:9mm"><col></colgroup>'
      +'<tbody>'+cells+'</tbody></table>';
  }

  const payeeSig=d.signature?'<img class="sig-fixed" src="'+d.signature+'">':'';
  const addrLine=d.addrSame?'■同上　　□不同：':'□同上　　■不同：'+esc(d.addr2);
  const showReceipt=cfg.receipt||!!String(d.payeeName||'').trim()||BLANK_MODE;
  const pasteHead=showReceipt?`
    <div class="dash"></div>
    <div class="paste-title">單據黏貼處</div>
    <div class="paste-note">單據請分開黏貼，勿重疊。單據黏貼處不敷使用時，得自行新增。</div>`:'';
  const receiptBlock=showReceipt?`
    <div class="keep">
      <div class="receipt-title">社團法人台灣醫學生聯合會　領據</div>
      <table class="cover">
        <colgroup><col style="width:28mm"><col><col style="width:26mm"><col style="width:44mm"></colgroup>
        <tr><td>具領人姓名</td><td>${esc(d.payeeName)}</td>
            <td>身分證字號</td><td>${esc(d.payeeId)}</td></tr>
        <tr><td>明細／事由</td><td colspan="3">${esc(d.payeeReason)}</td></tr>
        <tr><td>金額</td><td colspan="3">合計新台幣　${esc(d.payeeAmtZh)}元整</td></tr>
        <tr><td>戶籍地址</td><td colspan="3">${esc(d.addr1)}</td></tr>
        <tr><td>通訊地址</td><td colspan="3">${addrLine}</td></tr>
        <tr><td>電話</td><td>${esc(d.phone)}</td>
            <td class="ctr" rowspan="2">具領人簽章</td>
            <td rowspan="2" class="ctr" style="height:22mm">${payeeSig}</td></tr>
        <tr><td>日期</td><td>${esc(d.payeeDate)}</td></tr>
      </table>
    </div>`:'';

  const figs=[];
  /* PDF 來源的憑證（電子登機證、電子收據等）不縮成小圖，
     每一頁單獨占一整頁、寬度撐滿 A4 內容區。 */
  let fullPages='';
  items.forEach(it=>{
    const imgs=(it.imgs&&it.imgs.length)?it.imgs:(it.img?[it.img]:[]);
    if(!imgs.length) return;
    const mm=Number(it.widthMm)||0;
    imgs.forEach((src,k)=>{
      const pg=imgs.length>1?('　第 '+(k+1)+'／'+imgs.length+' 頁'):'';
      const cap='憑證 '+esc(it.vno)+'　'+money(it.amt)+pg;
      if(it.pdf){
        fullPages+='<div class="page">'+rh
          +'<div class="paste-title" style="margin-top:6px">單據黏貼處</div>'
          +'<div class="paste-note">'+cap+'　'+esc(it.item||'')+'</div>'
          +'<img class="fullimg" src="'+src+'">'
          +'<div class="pn"></div></div>';
      }else{
        figs.push(mm>0
          ? '<figure class="real" style="width:'+mm+'mm"><img src="'+src+'">'
            +'<figcaption>'+cap+'　實際寬 '+mm+'mm</figcaption></figure>'
          : '<figure><img src="'+src+'"><figcaption>'+cap+'</figcaption></figure>');
      }
    });
  });

  /* 單據黏貼處分頁：每頁 2×2 共 4 張。
     每頁高度固定為 A4 且超出部分會被裁掉，全部塞同一頁的話第 5 張起會消失。 */
  const PER_PAGE=4;
  let pastePages='';
  const pasteNote='<div class="paste-note">單據請分開黏貼，勿重疊。單據黏貼處不敷使用時，得自行新增。</div>';
  if(!figs.length){
    pastePages='<div class="page">'+rh
      +'<div class="paste-title" style="margin-top:6px">單據黏貼處</div>'+pasteNote
      +'<div style="text-align:center;color:#999;font-size:10pt;margin-top:14mm">'
      +'（未上傳憑證影像，此頁供黏貼實體單據）</div><div class="pn"></div></div>';
  }else{
    for(let i=0;i<figs.length;i+=PER_PAGE){
      pastePages+='<div class="page">'+rh
        +'<div class="paste-title" style="margin-top:6px">單據黏貼處'
        +(figs.length>PER_PAGE?'（續）'.slice(i?0:4):'')+'</div>'
        +(i===0?pasteNote:'')
        +'<div class="rcpt-grid">'+figs.slice(i,i+PER_PAGE).join('')+'</div>'
        +'<div class="pn"></div></div>';
    }
  }

  $('pvBody').innerHTML=`
  <div class="page">
    ${rh}
    <div class="org">社團法人台灣醫學生聯合會</div>
    <div class="sec">1.　核銷封面</div>
    ${cover}
    <div class="pn"></div>
  </div>

  <div class="page">
    ${rh}
    <div class="org">社團法人台灣醫學生聯合會</div>
    <div class="sec">2.支出憑證黏存單</div>
    <div class="fdate">填單日期：${esc(d.fileDate)}</div>
    ${itemTable}
    ${sigTable}
    ${icBlock}
    ${pasteHead}
    ${receiptBlock}
    <div class="pn"></div>
  </div>

  ${pastePages}
  ${fullPages}`;
  renumberPages();
}

/** 頁碼一律依實際頁數重編，避免加了整頁單據之後對不上；單頁不編號 */
function renumberPages(){
  const pages=[...document.querySelectorAll('#pvBody .page')];
  pages.forEach((p,i)=>{
    const el=p.querySelector('.pn');
    if(el) el.textContent = pages.length>1 ? ((i+1)+'／'+pages.length) : '';
  });
}

function fitPreview(){
  const box=$('sheets');
  if(!document.body.classList.contains('previewing'))return;
  const avail=box.clientWidth-32;
  const s=Math.min(1,Math.max(0.35,avail/794));
  $('pvBody').style.zoom=s;
  $('pvHint').textContent='縮放 '+Math.round(s*100)+'%　實際列印為 A4 原尺寸';
}
/** 產生一張完全空白的單據，供列印當範例 */
function printBlank(){
  if(!cfg){ setStatus('請先選擇單別','err-msg'); return; }
  const b={
    formType:formType, type:'settle',
    expenseType:'', projectName:'', adminType:'', deptTitle:'', staffName:'',
    kind:'', budgetCode:(cfg.budgetCode||''), dept:(cfg.dept||''), docNo:'',
    fileDate:'', loName:'', loSchool:'',
    adminUse:'', planCode:'', phone2:'', advanceAmount:'',
    eventName:'', refundReason:'', refundMode:'', refunds:[], refundTotal:'',
    acctName:'', acctNo:'', bank:'', bankCode:'', branch:'', passbook:'',
    budgetName:'', voucherCount:0,
    advanceDrawn:'', advanceNo:'', prepaid:'', outOfPocket:'',
    payeeName:'', payeeId:'', payeeReason:'', payeeAmt:'', payeeAmtZh:'',
    addr1:'', addrSame:false, addr2:'', phone:'', payeeDate:'',
    signature:'', ics:[], items:[]
  };
  if(cfg.layout==='refund'){
    b.refundMode='分別退給報名者';
    for(let i=0;i<8;i++) b.refunds.push({name:'',amt:'',bank:'',bankCode:'',branch:'',
      branchCode:'',acctNo:'',acctName:'',passbook:''});
  }else if(cfg.layout!=='advance'){
    for(let i=0;i<10;i++) b.items.push({code:'',cat:'',vno:String(i+1),item:'',use:'',
      amt:'',widthMm:0,img:''});
  }
  BLANK_MODE=true;
  try{
    renderSheets(b);
    setStatus('已產生空白表，列印視窗選「另存為 PDF」即可','ok-msg');
    setTimeout(()=>{ window.print(); BLANK_MODE=false; },400);
  }catch(err){
    BLANK_MODE=false;
    setStatus('產生空白表失敗：'+err.message,'err-msg');
  }
}

/* ── 退件重送 ───────────────────────────── */

function reHint(msg,bad){
  const el=$('reHint'); if(!el) return;
  el.textContent=msg||'';
  el.style.color = bad ? 'var(--danger)' : 'var(--faint)';
}

/** 從被退回的 PDF 讀出單號，再走同一條載入流程 */
async function pickReturned(input){
  const f=input.files[0]; if(!f) return;
  if(typeof pdfjsLib==='undefined'){ reHint('PDF 元件載入失敗，請改用輸入單號',true); return; }
  reHint('讀取 '+f.name+'…');
  try{
    pdfjsLib.GlobalWorkerOptions.workerSrc=
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf=new Uint8Array(await f.arrayBuffer());
    const doc=await pdfjsLib.getDocument({isEvalSupported:false,data:buf}).promise;
    let found='';
    for(let p=1;p<=doc.numPages&&!found;p++){
      const tc=await (await doc.getPage(p)).getTextContent();
      const items=tc.items.map(t=>(t.str||'').trim());
      const i=items.findIndex(t=>/核銷單號|預支單號|退費單號/.test(t));
      if(i>=0){
        for(let k=i+1;k<Math.min(i+5,items.length);k++){
          const v=items[k];
          if(v&&v.length<=24&&!/單號/.test(v)){ found=v; break; }
        }
      }
      if(!found){
        const m=items.join(' ').match(/\b\d{3}[A-Z]{1,3}[APL]?\d{2}\b|REF-\d{8}-\d{4}/);
        if(m) found=m[0];
      }
    }
    if(!found){ reHint('這份 PDF 裡找不到單號，請手動輸入',true); return; }
    $('reDocNo').value=found;
    reHint('偵測到單號 '+found+'，載入中…');
    loadExisting();
  }catch(err){
    reHint('讀取失敗：'+err.message,true);
  }
}

function loadExisting(){
  const no=($('reDocNo').value||'').trim();
  if(!no){ reHint('請先輸入單號',true); return; }
  if(typeof google==='undefined'||!google.script){ reHint('預覽模式：未連線後端',true); return; }
  reHint('讀取 '+no+' …');
  google.script.run
    .withSuccessHandler(d=>{
      if(!d||!d.formType){ reHint('讀不到這張單的內容',true); return; }
      chooseType(d.formType);
      EDIT_MODE=true;
      applyData(d);
      const tag=document.createElement('span');
      tag.className='editbadge'; tag.id='editBadge';
      tag.textContent='退件重送　'+no;
      const old=$('editBadge'); if(old) old.remove();
      $('typeNow').appendChild(tag);
      setStatus('已載入 '+no+' 的內容，修改後送出會覆蓋原紀錄（單號不變）','ok-msg');
      reHint('');
    })
    .withFailureHandler(e=>reHint(e.message,true))
    .getRecordForEdit(no);
}

function preview(){
  renderSheets(collect());
  document.body.classList.add('previewing');
  fitPreview();
  setStatus('右側為版面預覽，修改欄位後再按一次可更新','ok-msg');
}
function closePreview(){
  document.body.classList.remove('previewing');
  setStatus('');
}
window.addEventListener('resize',fitPreview);

function showNext(){
  if($('nextStep'))return;
  const d=document.createElement('div');
  d.id='nextStep';
  d.style.cssText='max-width:880px;margin:24px auto;padding:18px 22px;border:1px solid var(--ok);'
    +'background:#f4faf8;font-size:14px;line-height:1.7';
  d.innerHTML='<div style="font-weight:500;margin-bottom:6px">下一步：送出簽核</div>'
    +'<div>在列印視窗選「另存為 PDF」把檔案存下來，接著到簽核頁上傳，填入各關簽核者信箱即可啟動流程。</div>'
    +'<div style="margin-top:10px"><a href="'+signUrl()+'" target="_blank" rel="noopener" style="color:#0b5c47">開啟簽核頁</a></div>';
  document.querySelector('.wrap').appendChild(d);
}

/* ── 送出結果處理（三種單別共用） ─────────── */

function submitOk(r,withNext){
  $('submitBtn').disabled=false;
  setStatus((r.mode==='update'?'已更新　':'已送出　')+r.docNo
    +(r.settle?('　'+r.settle):'')+'　請在列印視窗選「另存為 PDF」','ok-msg');
  clearDraft();
  if(withNext) showNext();
  setTimeout(()=>window.print(),400);
}

/**
 * 單號重複時不要只是擋下來。填表人常常是送出後才發現要改，
 * 這裡直接問要不要覆蓋原本那一筆，免得他得繞去退件重送。
 */
function submitFail(d,e,withNext){
  $('submitBtn').disabled=false;
  const msg=String((e&&e.message)||e||'');
  if(msg.indexOf('已存在')>=0){
    if(confirm(msg+'\n\n要用你現在填的內容覆蓋原本那一筆嗎？\n單號不變，原本的明細會被取代。')){
      EDIT_MODE=true; d.isEdit=true;
      $('submitBtn').disabled=true;
      setStatus('覆蓋中，請稍候…','');
      google.script.run
        .withSuccessHandler(r=>submitOk(r,withNext))
        .withFailureHandler(e2=>{
          $('submitBtn').disabled=false;
          setStatus('覆蓋失敗：'+e2.message,'err-msg');
        })
        .saveRecord(d);
      return;
    }
    setStatus('已取消。若要改原本那一筆，也可以回選單用「退件重送」載入。','err-msg');
    return;
  }
  setStatus('送出失敗：'+msg,'err-msg');
}

function submitForm(){
  const d=collect();
  const general=cfg.layout==='general';
  const adv=cfg.layout==='advance';
  const ref=cfg.layout==='refund';
  let need;
  if(ref){
    need=[['docNoR','退費單號'],['eventName','活動名稱'],['refundReason','退款原因'],
          ['deptR','部門'],['staffR','負責幹部'],['phoneR','連絡電話']];
    for(const [id,lbl] of need){
      if(!val(id)){setStatus('請填寫必填欄位：'+lbl,'err-msg');$(id).focus();return;}
    }
    if(!d.refundMode){setStatus('請選擇退款方式','err-msg');return;}
    if(d.refundMode==='分別退給報名者'){
      if(!d.refunds.length){setStatus('請至少填一筆退款明細','err-msg');return;}
    }else{
      for(const [id,lbl] of [['acctName','戶名'],['bank','銀行'],['branch','分行'],
                             ['bankCode','銀行代碼'],['acctNo','帳號']]){
        if(!val(id)){setStatus('請填寫負責幹部的帳戶資料：'+lbl,'err-msg');$(id).focus();return;}
      }
      if(!d.refundTotal){setStatus('請填寫退款總金額','err-msg');$('refundTotalInput').focus();return;}
    }
    renderSheets(d);
    if(typeof google==='undefined'||!google.script){
      setStatus('預覽模式：欄位檢查通過，已產生版面','ok-msg');
      setTimeout(()=>window.print(),400); return;
    }
    $('submitBtn').disabled=true;
    setStatus('儲存中，請稍候…','');
    google.script.run
      .withSuccessHandler(r=>submitOk(r,false))
      .withFailureHandler(e=>submitFail(d,e,false))
      .saveRecord(d);
    return;
  }
  if(adv){
    const g=!!cfg.advG;
    need=[['adminUse',g?'計畫名稱或行政用途':'行政用途'],['docNoA','預支單號'],
          ['advanceAmount','預支金額'],['planCode','計畫編號'],
          ['loNameA',g?'姓名':'LO姓名']];
    if(!g) need.push(['loSchoolA','LO學校']);
    need=need.concat([['phone2','連絡電話'],['deptA',g?'部門職稱':'部門'],
          ['acctName','戶名'],['bank','銀行'],['branch','分行'],
          ['bankCode','銀行代碼'],['acctNo','帳號']]);
    for(const [id,lbl] of need){
      if(!val(id)){setStatus('請填寫必填欄位：'+lbl,'err-msg');$(id).focus();return;}
    }
    renderSheets(d);
    if(typeof google==='undefined'||!google.script){
      setStatus('預覽模式：欄位檢查通過，已產生版面','ok-msg');
      setTimeout(()=>window.print(),400); return;
    }
    $('submitBtn').disabled=true;
    setStatus('儲存中，請稍候…','');
    google.script.run
      .withSuccessHandler(r=>submitOk(r,true))
      .withFailureHandler(e=>submitFail(d,e,true))
      .saveRecord(d);
    return;
  }
  if(general){
    need=[['docNoG','核銷單號'],['budgetCodeG','預算科目'],['budgetNameG','預算名稱'],
          ['deptTitle','部門職稱'],['staffName','幹部姓名']];
    if(!d.expenseType){setStatus('請選擇支出別（計劃支出 P 或行政支出 A）','err-msg');return;}
    if(d.expenseType==='P'&&!d.projectName){setStatus('請填寫計劃名稱','err-msg');$('projectName').focus();return;}
    if(d.expenseType==='A'&&!d.adminType){setStatus('請選擇行政支出類別','err-msg');return;}
  }else{
    need=[['kind','核銷種類'],['budgetCode','預算科目'],['budgetName','預算名稱'],['dept','部門'],
          ['docNo','核銷單號'],['loName','LO姓名'],['loSchool','LO學校']];
  }
  need=need.concat([['acctName','戶名'],['bank','銀行'],['branch','分行'],
    ['bankCode','銀行代碼'],['acctNo','帳號']]);
  if(cfg.receipt){
    need=need.concat([['payeeName','具領人姓名']]);
  }
  for(const [id,lbl] of need){
    if(!val(id)){setStatus('請填寫必填欄位：'+lbl,'err-msg');$(id).focus();return;}
  }
  if(d.items.length===0){setStatus('請至少填一筆支出憑證明細','err-msg');return;}
  const wantReceipt=cfg.receipt||!!String(d.payeeName||'').trim();
  if(wantReceipt&&!d.signature){
    setStatus('已填具領人姓名，領據需要具領人簽章影像','err-msg');$('sig').focus();return;
  }
  if(wantReceipt){
    for(const [id,lbl] of [['payeeId','身分證字號'],['payeeReason','明細／事由'],
                           ['addr1','戶籍地址'],['phone','電話']]){
      if(!val(id)){setStatus('領據欄位未填完：'+lbl+'（不需要領據的話請清空具領人姓名）','err-msg');
                   $(id).focus();return;}
    }
  }

  if(d.voucherCount>d.items.length){
    if(!confirm('憑證張數填「'+d.voucherCount+'」，但實際只填了 '+d.items.length
      +' 筆明細。\n\n仍要以 '+d.items.length+' 筆送出嗎？')) return;
  }

  renderSheets(d);
  if(typeof google==='undefined'||!google.script){
    setStatus('預覽模式：欄位檢查通過，已產生版面。列印即可存成 PDF。','ok-msg');
    setTimeout(()=>window.print(),400);
    return;
  }
  $('submitBtn').disabled=true;
  setStatus('儲存中，請稍候…','');
  google.script.run
    .withSuccessHandler(r=>submitOk(r,true))
    .withFailureHandler(e=>submitFail(d,e,true))
    .saveRecord(d);
}

function saveBank(){
  const p={bank:val('bank'),bankCode:val('bankCode'),branch:val('branch'),
    acctName:val('acctName'),acctNo:val('acctNo'),passbook:passbookData};
  if(typeof google==='undefined'||!google.script){setStatus('預覽模式：未連線後端','err-msg');return;}
  setStatus('儲存帳戶資料中…','');
  google.script.run.withSuccessHandler(m=>setStatus(m,'ok-msg'))
    .withFailureHandler(e=>setStatus(e.message,'err-msg')).saveBankProfile(p);
}
function loadBank(){
  if(typeof google==='undefined'||!google.script){setStatus('預覽模式：未連線後端','err-msg');return;}
  setStatus('讀取中…','');
  google.script.run.withSuccessHandler(p=>{
    if(!p){setStatus('尚無已存資料（或系統無法辨識登入者）','err-msg');return;}
    $('bank').value=p.bank||'';$('bankCode').value=p.bankCode||'';$('branch').value=p.branch||'';
    $('acctName').value=p.acctName||'';$('acctNo').value=p.acctNo||'';
    if(p.passbook){passbookData=p.passbook;const pv=$('passbookPrev');pv.src=p.passbook;pv.classList.add('show');}
    setStatus('已帶入帳戶資料','ok-msg');
  }).withFailureHandler(e=>setStatus(e.message,'err-msg')).getBankProfile();
}

function hideSheets(){
  document.body.classList.remove('previewing');
  $('pvBody').innerHTML='';
}

function hardReset(){
  EDIT_MODE=false;
  const _b=$('editBadge'); if(_b) _b.remove();
  document.querySelectorAll('.filepick').forEach(b=>b.remove());
  document.querySelectorAll('input[type=file]').forEach(e=>{e.value='';e.style.display='';});
  document.querySelectorAll('.thumb-box').forEach(b=>b.innerHTML='');
  document.querySelectorAll('input,textarea,select').forEach(e=>{
    if(e.type==='file'||e.readOnly)return;
    if(e.type==='checkbox'){e.checked=(e.id==='addrSame');return;}
    if(e.type==='radio'){e.checked=false;return;}
    e.value=e.type==='number'?'0':'';
  });
  $('itemsBody').innerHTML='';
  $('icBody').innerHTML='';$('icCount').textContent='0';
  passbookData='';sigData='';
  $('passbookPrev').classList.remove('show');$('sigPrev').classList.remove('show');
  hideSheets();
  const n=$('nextStep'); if(n) n.remove();
  const today=new Date().toISOString().slice(0,10);
  $('fileDate').value=today;$('payeeDate').value=today;
  onExpenseType();onAdminType();toggleAddr();calcZh();setStatus('');
}
function clearAll(){
  if(!confirm('確定清除所有欄位？'))return;
  hardReset();
  $('voucherCount').value=2;syncRows();calc();
}

var APP_URL='';
function pageUrl(p){ return p==='sign'?'sign.html':p+'.html'; }
function signUrl(){ return pageUrl('sign'); }
function loadAppUrl(){
  if(typeof google==='undefined'||!google.script) return;
  google.script.run.withSuccessHandler(function(u){
    APP_URL=u||'';
    if(APP_URL){
      $('signLink').href='sign.html';
      if($('stampLink')) $('stampLink').href='sign.html';
    }
  }).withFailureHandler(function(){}).getAppUrl();
}

function bindChooser(){ return; /* inline handlers already bind these buttons */
  document.querySelectorAll('#chooser .opt').forEach(function(b){
    var t=b.getAttribute('data-type');
    if(t) b.addEventListener('click', function(){ chooseType(t); });
  });
}

initDrag();
bindChooser();
loadAppUrl();
const today=new Date().toISOString().slice(0,10);
$('fileDate').value=today;$('payeeDate').value=today;$('fileDateR').value=today;
calcZh();
