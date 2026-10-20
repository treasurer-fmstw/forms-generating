'use strict';
let currentRecord=null,dirty=false,saving=false,draftId=crypto.randomUUID(),activeRequest=null;
const sessionLinks=new URLSearchParams(location.hash.slice(1));
const baseCollect=collect;
collect=function(){return {...baseCollect(),claimAmount:val('claimAmount'),claimNote:val('claimNote')};};
const baseApply=applyData;
applyData=function(d){baseApply(d);$('claimAmount').value=d.claimAmount??'';$('claimNote').value=d.claimNote||'';calc();labelRows();};
esc=function(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
const baseChoose=chooseType;
chooseType=function(type){
 currentRecord=null;activeRequest=null;draftId=crypto.randomUUID();
 $('claimAmount').value='';$('claimNote').value='';
 baseChoose(type);$('fileDate').value=localDate();labelRows();
};
function localDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
calc=function(){
 let total=0;document.querySelectorAll('#itemsBody tr').forEach((tr,i)=>{tr.querySelector('.no').textContent=i+1;tr.querySelector('.vno').value=i+1;total+=Number(tr.querySelector('.amt input').value)||0;});
 $('grandTotal').textContent=nf(total);
 const claim=val('claimAmount')===''?total:Number(val('claimAmount'));
 const net=claim-(Number(val('advanceDrawn'))||0)-(Number(val('prepaid'))||0);
 $('claimDifference').textContent='不申請核銷差額：'+nf(total-claim);
 $('settleAmt').textContent=nf(Math.abs(net));
 $('sResult').textContent=net>0?'本會應撥付':net<0?'應繳回本會':'結清';
 $('sResult').className='tag '+(net>0?'warn':'ok');
};
function labelRows(){
 for(const table of document.querySelectorAll('table.form')){
  const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
  for(const row of table.querySelectorAll('tbody tr'))[...row.children].forEach((td,i)=>{td.dataset.label=heads[i]||'';for(const el of td.querySelectorAll('input,select,button'))if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',heads[i]||'移除此筆');});
 }
 for(const label of document.querySelectorAll('.f label')){if(!label.htmlFor){const input=label.parentElement.querySelector('input[id],select[id],textarea[id]');if(input)label.htmlFor=input.id;}}
}
const baseAdd=addRowSilent;addRowSilent=function(){baseAdd();labelRows();};
const baseRefund=addRefundRow;addRefundRow=function(){baseRefund();labelRows();};
function showMode(){const el=$('modeNote');el.textContent=Service.local?'本機測試模式 · 資料只存在這台裝置，尚未送交財務':'雲端模式 · 儲存成功後可用專屬連結跨裝置接續';}
function reportError(e){setStatus(e.message||String(e),'err-msg');}
async function refreshDrafts(){
 const list=(await LocalDB.entries('draft:')).sort((a,b)=>b[1].t-a[1].t).slice(0,8),box=$('recentDrafts');
 box.replaceChildren();if(!list.length)return;
 const h=document.createElement('h2');h.textContent='繼續填寫';box.append(h);
 for(const [key,p]of list){const b=document.createElement('button');b.className='draft-chip';b.textContent=(FMSTW.types[p.d.formType]?.label||'草稿')+' · '+(p.d.docNo||'尚未填單號')+' · '+new Date(p.t).toLocaleString('zh-TW');b.onclick=()=>restoreDraft(key);box.append(b);}
}
async function restoreDraft(key){
 try{const p=await LocalDB.get(key);if(!p)throw Error('草稿不存在');hardReset();chooseType(p.d.formType);draftId=key.slice(6);applyData(p.d);currentRecord=p.record||null;activeRequest=p.pending||null;dirty=false;setStatus('已載入這台裝置的草稿。雲端進度請重新載入確認。','ok-msg');}catch(e){reportError(e);}
}
saveDraft=async function(silent=false){
 if(!formType)return false;
 try{const snapshot=JSON.stringify(collect());await LocalDB.put('draft:'+draftId,{t:Date.now(),d:JSON.parse(snapshot),record:currentRecord,pending:activeRequest});dirty=JSON.stringify(collect())!==snapshot;if(!silent)setStatus('已儲存本機草稿。跨裝置請使用「儲存雲端草稿」。','ok-msg');else $('jsFlag').textContent='本機草稿已存 '+new Date().toLocaleTimeString('zh-TW');return true;}
 catch(e){setStatus('草稿未儲存：'+e.message+'。請勿關閉頁面，可先匯出備份。','err-msg');return false;}
};
clearDraft=function(){LocalDB.remove('draft:'+draftId).catch(reportError);};
loadDraft=async function(){try{const rows=(await LocalDB.entries('draft:')).filter(([,p])=>p.d.formType===formType).sort((a,b)=>b[1].t-a[1].t);if(!rows.length)throw Error('這個單別沒有本機草稿');if(confirm('載入此單別最近的草稿？'))await restoreDraft(rows[0][0]);}catch(e){reportError(e);}};
async function persist(submit){
 if(saving)return;
 const d=collect();FMSTW.validate(d,submit);
 if(currentRecord&&JSON.stringify(d)===JSON.stringify((({registryCheck,...editable})=>editable)(currentRecord.data))&&(!submit||currentRecord.status!=='草稿')){await showLinks(currentRecord);setStatus('內容沒有變更，沿用現有版本 '+currentRecord.version,'ok-msg');return;}
 if(currentRecord?.signatures?.length&&!confirm('修改正式內容會建立新版本，並重新簽核。舊版與原簽章會保留。確定繼續？'))return;
 if(currentRecord&&currentRecord.data.docNo!==d.docNo)throw Error('編輯原單時不能更換單號；請另外新增單據');
 const snapshot=JSON.stringify({d,submit});
 if(!activeRequest||activeRequest.snapshot!==snapshot)activeRequest={snapshot,id:crypto.randomUUID(),editToken:currentRecord?.editToken||Service.token(),signToken:Service.token()};
 saving=true;$('submitBtn').disabled=true;
 try{
  setStatus('正在儲存，請稍候…','');
  if(!await saveDraft(true))throw Error('請先解決本機草稿儲存失敗，再送出，避免失去重試資料');
  const r=await Service.rpc('save',{data:d,submit,adminToken:sessionStorage.getItem('fmstwAdmin')||'',version:currentRecord?.version||0,signatureCount:currentRecord?.signatures?.length||0,editToken:activeRequest.editToken,createSignToken:activeRequest.signToken,requestId:activeRequest.id});
  currentRecord=r;activeRequest=null;EDIT_MODE=true;await saveDraft(true);
  renderSheets(d);await showLinks(r);
  setStatus((Service.local?'本機測試已儲存':'雲端已儲存')+' · '+r.data.docNo+' · 內容版本 '+r.version+(submit?'。可預覽、下載 PDF。':'。可繼續修改。'),'ok-msg');
 }finally{saving=false;$('submitBtn').disabled=false;}
}
submitForm=()=>persist(true).catch(reportError);
async function saveCloudDraft(){try{await persist(false);}catch(e){reportError(e);}}
function recordUrl(r,sign=false){const url=new URL(sign?'sign.html':'index.html',location.href);url.hash=new URLSearchParams({doc:r.data.docNo,[sign?'sign':'edit']:sign?r.signToken:r.editToken}).toString();return url.href;}
async function showLinks(r){
 let box=$('nextStep');if(!box){box=document.createElement('section');box.id='nextStep';document.querySelector('.wrap').append(box);}box.replaceChildren();
 const title=document.createElement('h2');title.textContent=Service.local?'本機測試單據':'單據已儲存';box.append(title);
 const note=document.createElement('p');note.textContent=Service.local?'下列連結只能在同一瀏覽器測試；未連接雲端，不能傳給別人跨裝置使用。':'修改連結可編輯此單；簽核連結僅供簽核。請分別交給適當的人。';box.append(note);
 for(const [label,sign]of [['修改連結',false],['簽核連結',true]]){if(sign&&!FMSTW.types[r.data.formType].roles.length)continue;const row=document.createElement('div');row.className='link-row';const input=document.createElement('input');input.readOnly=true;input.value=recordUrl(r,sign);input.setAttribute('aria-label',label);const button=document.createElement('button');button.textContent='複製'+label;button.onclick=async()=>{try{await navigator.clipboard.writeText(input.value);button.textContent='已複製';}catch{input.select();setStatus('請手動複製已選取的連結','');}};row.append(input,button);box.append(row);}
 if(r.status!=='草稿'&&FMSTW.types[r.data.formType].roles.length){const b=document.createElement('button');b.textContent='產生並保存待簽 PDF';b.onclick=()=>prepareSigningPdf().catch(reportError);box.append(b);}
 const backup=document.createElement('button');backup.textContent='匯出單據備份（含私人資料）';backup.onclick=()=>downloadBlob(new Blob([JSON.stringify(r.data,null,2)],{type:'application/json'}),r.data.docNo+'.json');box.append(backup);
}
async function openRecord(){
 try{
  const docNo=$('reDocNo').value.trim(),editToken=$('accessCode').value.trim();
  if(!editToken)throw Error('請使用專屬修改連結或輸入修改碼');
  const r=await Service.rpc('get',{docNo,editToken});hardReset();chooseType(r.data.formType);currentRecord=r;applyData(r.data);EDIT_MODE=true;
  await showLinks(r);setStatus('已載入內容版本 '+r.version+'；修改送出會建立新版並重新簽核','ok-msg');
 }catch(e){reportError(e);$('reHint').textContent=e.message;}
};
loadExisting=openRecord;
async function batchReceipts(input){
 const files=[...input.files];for(const f of files){
  try{if(f.size>FMSTW_CONFIG.maxFileBytes)throw Error(f.name+'超過單檔 12 MB 限制');setStatus('處理 '+f.name+'…','');const imgs=await fileToImages(f);addRowSilent();const tr=$('itemsBody').lastElementChild;tr.dataset.img=imgs[0];tr.dataset.imgs=JSON.stringify(imgs);if(f.type==='application/pdf')tr.dataset.pdf='1';tr.querySelector('.thumb-box').replaceChildren();const img=new Image();img.src=imgs[0];img.className='thumb';tr.querySelector('.thumb-box').append(img);tr.querySelectorAll('input')[2].value=f.name.replace(/\.[^.]+$/,'');calc();dirty=true;await saveDraft(true);}catch(e){reportError(e);break;}
 }input.value='';labelRows();
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.textContent='若未自動下載，點此下載 '+name;a.className='download-fallback';document.querySelector('.wrap').append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},120000);}
async function prepareSigningPdf(){
 if(!currentRecord||currentRecord.status==='草稿')throw Error('請先送出並儲存單據');
 if(JSON.stringify(collect())!==JSON.stringify((({registryCheck,...editable})=>editable)(currentRecord.data)))throw Error('欄位已變更，請先儲存新版再產生簽核 PDF');
 const blob=await makePdf(currentRecord.data),b64=await blobB64(blob);
 currentRecord=await Service.rpc('pdf',{docNo:currentRecord.data.docNo,editToken:currentRecord.editToken,version:currentRecord.version,b64,name:currentRecord.data.docNo+'.pdf',requestId:crypto.randomUUID()});
 downloadBlob(blob,currentRecord.data.docNo+'.pdf');setStatus('待簽 PDF 已保存，可將簽核連結交給下一位','ok-msg');
}
async function blobB64(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
async function downloadCurrentPdf(){try{const d=collect();FMSTW.validate(d,true);downloadBlob(await makePdf(d),d.docNo+'.pdf');}catch(e){reportError(e);}}
// PDF generation lives in pdf.js; load only when requested.
async function makePdf(d){await loadScriptOnce('assets/pdf.js');return window.buildDocumentPdf(d,FORMS[d.formType]);}
function attachControls(){
 const cloud=document.createElement('button');cloud.className='btn btn-text';cloud.textContent=Service.local?'儲存測試單':'儲存雲端草稿';cloud.onclick=saveCloudDraft;document.querySelector('.more-actions-panel').append(cloud);
 const backup=document.createElement('label');backup.className='draft-chip';backup.textContent='匯入單據備份';const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{const f=input.files[0];if(f.size>FMSTW_CONFIG.maxRecordBytes)throw Error('備份過大');const d=JSON.parse(await f.text());FMSTW.validate(d,false);hardReset();chooseType(d.formType);applyData(d);await saveDraft(false);}catch(e){reportError(e);}};backup.append(input);$('chooser').append(backup);
}
window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
document.addEventListener('input',e=>{if(e.target.closest('#form')){dirty=true;scheduleAutoSave();}});document.addEventListener('change',e=>{if(e.target.closest('#form')){dirty=true;scheduleAutoSave();labelRows();}});
$('batchReceipts').addEventListener('change',e=>batchReceipts(e.target));
showMode();attachControls();labelRows();$('jsFlag').textContent='前端已就緒';$('jsFlag').style.color='var(--faint)';
LocalDB.open().then(refreshDrafts).catch(e=>{$('modeNote').textContent='本機儲存不可用：'+e.message;});
if(sessionLinks.get('doc')&&sessionLinks.get('edit')){$('reDocNo').value=sessionLinks.get('doc');$('accessCode').value=sessionLinks.get('edit');openRecord();}
// Structural edits (delete/reorder/add) must also mark drafts dirty.
for(const id of ['itemsBody','refundBody','icBody'])new MutationObserver(()=>{if(formType){dirty=true;scheduleAutoSave();labelRows();}}).observe($(id),{childList:true});
for(const name of ['pickReceipt','pickPassbook','pickSig','pickRefundPassbook']){
 const original=window[name];window[name]=async function(...args){await original(...args);dirty=true;await saveDraft(true);};
}
clearAll=function(){if(!confirm('確定清除目前欄位？已存的歷史版本不會刪除。'))return;hardReset();currentRecord=null;activeRequest=null;draftId=crypto.randomUUID();$('claimAmount').value='';$('claimNote').value='';calc();};
