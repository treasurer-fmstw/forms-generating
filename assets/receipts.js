'use strict';
let receiptBusy=false;
const receiptZone=document.getElementById('receiptDrop');
const originalReceiptCollect=collect;
collect=function(){
 const d=originalReceiptCollect(),rows=[...$('itemsBody').rows].filter(row=>{const c=row.querySelectorAll('input');return c[2].value||c[4].value||row.dataset.img;});
 d.items.forEach((item,i)=>{item.attachmentName=rows[i]?.dataset.attachmentName||'';item.attachmentHash=rows[i]?.dataset.attachmentHash||'';});
 d.voucherCount=d.items.length;return d;
};
const originalReceiptApply=applyData;
applyData=function(d){originalReceiptApply(d);[...$('itemsBody').rows].forEach((row,i)=>{row.dataset.attachmentName=d.items?.[i]?.attachmentName||'';row.dataset.attachmentHash=d.items?.[i]?.attachmentHash||'';});decorateReceipts();};
function emptyReceiptRow(row){const c=row.querySelectorAll('input');return !row.dataset.img&&!c[2].value.trim()&&!c[3].value.trim()&&!c[4].value;}
function decorateReceipts(){
 const rows=[...$('itemsBody').rows];
 for(const row of rows){
  const cell=row.querySelector('.thumb-box');if(!cell)continue;
  let label=row.querySelector('.attachment-name');if(!label){label=document.createElement('small');label.className='attachment-name';cell.after(label);}label.textContent=row.dataset.attachmentName||'';
  let controls=row.querySelector('.receipt-order');if(!controls){
   controls=document.createElement('div');controls.className='receipt-order';
   for(const [title,delta]of [['上移',-1],['下移',1]]){const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('aria-label','此筆憑證'+title);button.onclick=()=>{const target=delta<0?row.previousElementSibling:row.nextElementSibling;if(!target)return;if(delta<0)target.before(row);else target.after(row);calc();decorateReceipts();};controls.append(button);}row.querySelector('.idx').append(controls);
  }
  controls.children[0].disabled=!row.previousElementSibling;controls.children[1].disabled=!row.nextElementSibling;
 }
 $('voucherCount').value=rows.filter(row=>!emptyReceiptRow(row)).length;
}
const receiptCalc=calc;calc=function(){receiptCalc();decorateReceipts();};
async function addReceiptFiles(files){
 if(receiptBusy){$('uploadProgress').textContent='目前正在整理上一批檔案，請稍候。';return;}
 if(!files.length)return;
 receiptBusy=true;window.pendingAttachmentReads=(window.pendingAttachmentReads||0)+1;receiptZone.setAttribute('aria-busy','true');$('batchReceipts').disabled=true;$('uploadErrors').replaceChildren();
 const startingType=formType,startingDraft=draftId;let added=0,duplicates=0,failed=0;
 const signatures=new Set([...$('itemsBody').rows].map(r=>r.dataset.attachmentHash).filter(Boolean));
 try{
  for(const [index,file]of [...files].entries()){
   $('uploadProgress').textContent='正在處理 '+(index+1)+'／'+files.length+'：'+file.name;
   try{
    if(file.size>FMSTW_CONFIG.maxFileBytes)throw Error('超過單檔 12 MB 限制');
    if(!/\.(jpe?g|png|webp|gif|bmp|heic|heif|hif|pdf)$/i.test(file.name)&&!/^image\//.test(file.type)&&file.type!=='application/pdf'&&!await HEIC.isHeic(file))throw Error('請使用圖片或 PDF');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(signatures.has(hash)){duplicates++;continue;}
    const imgs=await fileToImages(file);
    if(formType!==startingType||draftId!==startingDraft)throw Error('填單內容已切換，未將檔案加入其他單據');
    let row=[...$('itemsBody').rows].find(emptyReceiptRow);if(!row){addRowSilent();row=$('itemsBody').lastElementChild;}
    row.dataset.img=imgs[0];row.dataset.imgs=JSON.stringify(imgs);row.dataset.attachmentName=file.name;row.dataset.attachmentHash=hash;
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))row.dataset.pdf='1';else delete row.dataset.pdf;
    const c=row.querySelectorAll('input');c[2].value=file.name.replace(/\.[^.]+$/,'');if(!c[0].value)c[0].value=$('bulkCode').value.trim();if(!c[3].value)c[3].value=$('bulkUse').value.trim();
    const box=row.querySelector('.thumb-box');box.replaceChildren();const img=new Image();img.className='thumb';img.alt=file.name+'，'+imgs.length+' 頁';img.src=imgs[0];box.append(img);const pages=document.createElement('small');pages.textContent=imgs.length+' 頁';box.append(pages);
    signatures.add(hash);added++;dirty=true;calc();await saveDraft(true);
   }catch(e){failed++;const li=document.createElement('li');li.textContent=file.name+'：'+e.message;$('uploadErrors').append(li);}
   if(formType!==startingType||draftId!==startingDraft)break;
  }
 }finally{
  receiptBusy=false;window.pendingAttachmentReads--;receiptZone.removeAttribute('aria-busy');$('batchReceipts').disabled=false;$('batchReceipts').value='';
  $('uploadProgress').textContent='已加入 '+added+' 份'+(duplicates?'，略過 '+duplicates+' 份重複檔案':'')+(failed?'，'+failed+' 份未加入（見下方）':'')+'。請確認各筆項目、金額與用途。';decorateReceipts();
 }
}
batchReceipts=async function(input){await addReceiptFiles([...input.files]);};
let dragDepth=0;
receiptZone.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;receiptZone.classList.add('drag-over');});
receiptZone.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
receiptZone.addEventListener('dragleave',e=>{e.preventDefault();if(--dragDepth<=0){dragDepth=0;receiptZone.classList.remove('drag-over');}});
receiptZone.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;receiptZone.classList.remove('drag-over');addReceiptFiles([...e.dataTransfer.files]);});
receiptZone.addEventListener('keydown',e=>{if(e.target===receiptZone&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('batchReceipts').click();}});
// Dropping outside the target must not navigate away from an unsaved form.
window.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
window.addEventListener('drop',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();if(!receiptZone.contains(e.target))$('uploadProgress').textContent='請將檔案拖入憑證上傳區，避免放入其他單據欄位。';}});
$('applyBulk').onclick=async()=>{let count=0;for(const row of $('itemsBody').rows){const c=row.querySelectorAll('input');if(emptyReceiptRow(row))continue;if(!c[0].value.trim()&&$('bulkCode').value.trim()){c[0].value=$('bulkCode').value.trim();count++;}if(!c[3].value.trim()&&$('bulkUse').value.trim()){c[3].value=$('bulkUse').value.trim();count++;}}dirty=true;await saveDraft(true);$('uploadProgress').textContent='已帶入 '+count+' 個空白欄位，原有內容保留。';};
new MutationObserver(decorateReceipts).observe($('itemsBody'),{childList:true});
$('itemsBody').addEventListener('input',decorateReceipts);
decorateReceipts();
pickReceipt=async function(input){
 const file=input.files[0];if(!file)return;const row=input.closest('tr'),box=row.querySelector('.thumb-box');
 const context={type:formType,draft:draftId};window.pendingAttachmentReads=(window.pendingAttachmentReads||0)+1;
 try{
  if(file.size>FMSTW_CONFIG.maxFileBytes)throw Error('超過單檔 12 MB 限制');
  box.setAttribute('aria-busy','true');
  const imgs=await fileToImages(file);
  if(formType!==context.type||draftId!==context.draft||!row.isConnected)throw Error('單據或明細已切換，未加入此檔案');
  row.dataset.img=imgs[0];row.dataset.imgs=JSON.stringify(imgs);row.dataset.attachmentName=file.name;
  row.dataset.attachmentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))row.dataset.pdf='1';else delete row.dataset.pdf;
  box.replaceChildren();const img=new Image();img.src=imgs[0];img.className='thumb';img.alt=file.name;box.append(img);
  markPicked(input,file.name,()=>{for(const k of ['img','imgs','pdf','attachmentName','attachmentHash'])delete row.dataset[k];box.replaceChildren();dirty=true;calc();saveDraft(true);});
  dirty=true;calc();await saveDraft(true);
 }catch(e){setStatus('憑證未更換：'+e.message,'err-msg');input.value='';}finally{window.pendingAttachmentReads--;box.removeAttribute('aria-busy');}
};
