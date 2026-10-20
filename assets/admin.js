'use strict';
const el=id=>document.getElementById(id);
el('modeNote').textContent=Service.local?'本機測試：清單只含這台裝置資料，沒有雲端管理權限。':'管理憑證保留於本分頁工作階段，關閉分頁後需重新輸入。正式管理者登入仍待部署驗證。';
el('logout').onclick=()=>{sessionStorage.removeItem('fmstwAdmin');el('adminCode').value='';el('records').replaceChildren();el('message').textContent='已清除管理憑證';};
el('load').onclick=async()=>{
 el('load').disabled=true;
 try{
  const adminToken=el('adminCode').value;
  const rows=await Service.rpc('list',{adminToken});if(!Service.local)sessionStorage.setItem('fmstwAdmin',adminToken);el('records').replaceChildren();el('message').textContent=rows.length+' 筆';
  for(const r of rows){const row=document.createElement('div');row.className='admin-row';const name=document.createElement('strong');name.textContent=r.docNo;const detail=document.createElement('span');detail.textContent=FMSTW.types[r.formType].label+' · v'+r.version+' · '+r.status;
   const b=document.createElement('button');b.textContent='開啟並協助修正';b.onclick=async()=>{try{let full;if(Service.local)full=await LocalDB.get('record:'+r.docNo);else full=await Service.rpc('adminGet',{docNo:r.docNo,adminToken});const url=new URL('index.html',location.href);url.hash=new URLSearchParams({doc:r.docNo,edit:full.editToken});location.assign(url.href);}catch(e){el('message').textContent=e.message;}};row.append(name,detail,b);el('records').append(row);
  }
 }catch(e){el('message').textContent=e.message;}finally{el('load').disabled=false;}
};
