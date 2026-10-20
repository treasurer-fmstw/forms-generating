'use strict';
let loaded=null,signRequest=null;
const linkParams=new URLSearchParams(location.hash.slice(1));
$('docNo').value=linkParams.get('doc')||'';$('signAccess').value=linkParams.get('sign')||'';
$('modeNote').textContent=Service.local?'本機測試 · 無跨裝置雲端同步':'雲端資料服務';
$('pendingCard').style.display='none';
// No global pending list for anonymous users. Roles are tied to the document loaded.
onRole=function(){drawHighlights();$('pendingCard').style.display='none';$('goBtn').textContent=loaded?'蓋章、保存並下載':'蓋章並下載（本機 PDF）';};
loadProgress=function(){if(loaded){signedRoles=Object.fromEntries((loaded.signatures||[]).map(s=>[s.role,s.at]));renderSteps();}};
loadPending=function(){};
loadCloud=no=>{ $('docNo').value=no;openLatest(); };
async function openLatest(){
 try{
  $('goBtn').disabled=true;setMsg('載入最新版本…');
  const docNo=$('docNo').value.trim(),signToken=$('signAccess').value.trim();if(!signToken)throw Error('請輸入簽核碼或使用專屬簽核連結');
  const r=await Service.rpc('get',{docNo,signToken});
  if(!r.pdf)throw Error('填單者尚未保存待簽 PDF，請先請他產生並保存');
  loaded={...r,signToken};signRequest=null;
  $('formType').value=r.data.formType;ROLES=FMSTW.types[r.data.formType].roles.slice();
  $('role').innerHTML='';for(const role of ROLES){const opt=document.createElement('option');opt.textContent=role;opt.value=role;$('role').append(opt);}
  $('role').value=FMSTW.nextRole(r)||ROLES[ROLES.length-1];
  $('role').disabled=true;$('formType').disabled=true;
  signedRoles=Object.fromEntries(r.signatures.map(s=>[s.role,s.at]));
  pdfBytes=b64ToBytes(r.pdf.b64);fileName=r.pdf.name;await loadPdf();
  $('meta').textContent=docNo+' · 內容版本 '+r.version+' · 已簽 '+r.signatures.length+' 關';
  if(!FMSTW.nextRole(r)){
   $('goBtn').disabled=true;setMsg('全部關卡已完成，可下載最新 PDF','ok');
   const b=document.createElement('button');b.textContent='下載已完成 PDF';b.className='btn';b.onclick=()=>download(pdfBytes,fileName);$('done').replaceChildren(b);$('done').classList.add('show');
  }else setMsg('下一關：'+FMSTW.nextRole(r)+'。這是持簽核碼操作，未驗證本人身分。');
 }catch(e){loaded=null;pdfBytes=null;anchors=[];signRequest=null;$('goBtn').disabled=true;$('pages').replaceChildren();setMsg(e.message,'err');}
}
// Local file signing intentionally does not claim to have recorded an authenticated workflow.
const originalLocal=loadLocal;
loadLocal=async function(input){loaded=null;signRequest=null;$('role').disabled=false;$('formType').disabled=false;await originalLocal(input);onRole();};
signIt=async function(){
 if(!hasInk){setMsg('請先手寫或上傳簽章','err');return;}
 const role=$('role').value,a=manualMode?manualSpot:anchors.find(x=>x.role===role);
 if(!a){setMsg('請指定本次蓋章位置','err');return;}
 if(loaded&&FMSTW.nextRole(loaded)!==role){setMsg('目前不是這一關，請重新載入','err');return;}
 $('goBtn').disabled=true;
 try{
  if(!signRequest){
   const doc=await PDFLib.PDFDocument.load(pdfBytes.slice(0)),img=await doc.embedPng(padPng());
   let h=15*2.8346,w=img.width*h/img.height,k=Math.min(1,(a.boxW-6)/w,(a.boxH-4)/h);w*=k;h*=k;
   doc.getPages()[a.page-1].drawImage(img,{x:a.boxX+(a.boxW-w)/2,y:a.boxY+(a.boxH-h)/2,width:w,height:h});
   const bytes=new Uint8Array(await doc.save()),name=fileName.replace(/\.pdf$/i,'')+'_已簽'+role+'.pdf';
   signRequest={bytes,name,id:crypto.randomUUID()};
  }
  if(loaded){
   setMsg('保存新版中，確認成功後才完成這一關…');
   const r=await Service.rpc('sign',{docNo:loaded.data.docNo,signToken:loaded.signToken,version:loaded.version,expectedCount:loaded.signatures.length,role,b64:bytesToB64(signRequest.bytes),name:signRequest.name,requestId:signRequest.id});
   pdfBytes=signRequest.bytes;download(pdfBytes,signRequest.name);signRequest=null;
   setMsg('已保存並提供下載；前面簽章保留。請將簽核連結交給下一位。','ok');
   $('doneMsg').textContent='雲端／本機版本已確認儲存。下一關：'+(FMSTW.nextRole(r)||'全部完成');$('done').classList.add('show');
   loaded={...r,signToken:loaded.signToken};clearPad();await openLatest();
  }else{
   download(signRequest.bytes,signRequest.name);pdfBytes=signRequest.bytes;signRequest=null;setMsg('僅在本機蓋章並下載；未存回雲端，請自行傳檔。','ok');clearPad();
  }
 }catch(e){setMsg(e.message+'。未確認保存成功；請保留此頁，可按同一按鈕重試。','err');}
 finally{$('goBtn').disabled=!!loaded&&!FMSTW.nextRole(loaded);}
};
if(linkParams.get('doc')&&linkParams.get('sign')){
 // Wait for async type configuration before selecting the stored form.
 let attempts=0;const timer=setInterval(()=>{if(formTypes.length){clearInterval(timer);openLatest();}else if(++attempts>100){clearInterval(timer);setMsg('設定載入失敗，請重新整理','err');}},100);
}
