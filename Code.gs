/** Isolated v2 service. Do not paste into or deploy over the old production project. */
function doGet(e){
 const props=PropertiesService.getScriptProperties(),site=props.getProperty('SITE_URL')||'';
 if(e&&e.parameter.bridge==='1'){
  const origin=String(e.parameter.origin||'');
  const allowed=(props.getProperty('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim());
  if(!allowed.includes(origin)||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))return HtmlService.createHtmlOutput('未允許的網站來源');
  const channel=String(e.parameter.channel||'');if(!/^[\w-]{20,80}$/.test(channel))return HtmlService.createHtmlOutput('無效連線');
  const t=HtmlService.createTemplateFromFile('Bridge');t.boot=JSON.stringify({origin,channel});
  return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
 }
 const safe=site.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><main style="font:18px sans-serif;max-width:600px;margin:80px auto;padding:24px"><h1>單據系統已搬家</h1>'+( /^https:\/\//.test(site)?'<p><a href="'+safe+'" target="_top" rel="noreferrer">前往新單據工作台</a></p>':'<p>新網站尚未設定，請聯絡管理者。</p>')+'</main>');
}
function prop_(name){const v=PropertiesService.getScriptProperties().getProperty(name);if(!v)throw Error('資料服務尚未完成設定：'+name);return v;}
function sheet_(){return SpreadsheetApp.openById(prop_('DATABASE_ID')).getSheetByName('v2_index');}
function setupV2_(){
 // Explicit one-time setup on a new test spreadsheet. Never opens the legacy bound spreadsheet.
 const ss=SpreadsheetApp.openById(prop_('DATABASE_ID'));
 if(!ss.getSheetByName('v2_index'))ss.insertSheet('v2_index').appendRow(['docNo','fileId','version','formType','status','updatedAt']);
 if(!PropertiesService.getScriptProperties().getProperty('FOLDER_ID'))throw Error('請先指定專用私人資料夾 FOLDER_ID');
 return 'v2 索引已準備；未讀寫舊系統';
}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>(b+256).toString(16).slice(-2)).join('');}
function eq_(a,b){if(!a||!b)return false;const x=hash_(a),y=hash_(b);let v=0;for(let i=0;i<x.length;i++)v|=x.charCodeAt(i)^y.charCodeAt(i);return v===0;}
function newToken_(){return hash_(Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());}
function admin_(token){
 const entries=JSON.parse(prop_('ADMIN_TOKEN_HASHES')); // { SHA256(random individual token): admin label }
 const label=entries[hash_(token||'')];if(!label)throw Error('沒有管理權限');return String(label);
}
function find_(docNo){
 const sh=sheet_();if(!sh)throw Error('請先執行 setupV2_');const rows=sh.getDataRange().getValues();
 for(let i=1;i<rows.length;i++)if(String(rows[i][0])===docNo){const record=JSON.parse(DriveApp.getFileById(String(rows[i][1])).getBlob().getDataAsString());return {row:i+1,meta:rows[i],record,previousSignatureCount:record.signatures.length};}
 return null;
}
function publicRecord_(r,edit){
 const out={data:r.data,version:r.version,status:r.status,pdf:r.pdf||null,signatures:r.signatures||[],updatedAt:r.updatedAt};
 if(edit){out.editToken=r.editToken;out.signToken=r.signToken;out.history=r.history||[];}
 return out;
}
function persist_(r,hit,actor,reason){
 const at=new Date().toISOString();r.updatedAt=at;r.audit={actor,reason,at};
 r.history=[...(hit?hit.record.history||[]:[]),...(hit?[{fileId:hit.meta[1],version:hit.record.version,signatureCount:hit.previousSignatureCount,at:hit.record.updatedAt}]:[])];
 const folder=DriveApp.getFolderById(prop_('FOLDER_ID'));
 // New immutable snapshot first; update index only after file creation succeeds.
 const file=folder.createFile(Utilities.newBlob(JSON.stringify(r),'application/json',r.data.docNo+'_v'+r.version+'_'+Utilities.getUuid()+'.json'));
 const values=[r.data.docNo,file.getId(),r.version,r.data.formType,r.status,at];
 const sh=sheet_();if(hit)sh.getRange(hit.row,1,1,values.length).setValues([values]);else sh.appendRow(values);
 SpreadsheetApp.flush();return r;
}
function rpcV2(action,p){
 if(!p||typeof p!=='object')throw Error('請求格式錯誤');
 if(JSON.stringify(p).length>24*1024*1024)throw Error('單據資料超過測試版 24 MB 限制');
 if(action==='lookupRegistry')return lookupRegistry_(p);
 if(action==='list'){
  admin_(p.adminToken);const sh=sheet_();if(!sh)throw Error('資料庫未初始化');
  return sh.getDataRange().getValues().slice(1).map(r=>({docNo:String(r[0]),version:Number(r[2]),formType:String(r[3]),status:String(r[4]),updatedAt:String(r[5])}));
 }
 if(!['save','get','adminGet','pdf','sign'].includes(action))throw Error('不支援的操作');
 const docNo=String(action==='save'?(p.data||{}).docNo:p.docNo||'').trim();
 if(!/^[A-Za-z0-9_-]{3,48}$/.test(docNo))throw Error('無效單號');
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try{
  const hit=find_(docNo),r=hit&&hit.record;
  if(action==='adminGet'){admin_(p.adminToken);if(!r)throw Error('找不到單據');return publicRecord_(r,true);}
  const canEdit=r&&eq_(p.editToken,r.editToken),canSign=r&&eq_(p.signToken,r.signToken);
  if(action==='get'){if(!r||(!canEdit&&!canSign))throw Error('單據不存在或存取碼無效');return publicRecord_(r,canEdit);}
  if(!/^[\w-]{20,80}$/.test(String(p.requestId||'')))throw Error('缺少操作識別碼');
  if(action==='save'){
   FMSTW.validate(p.data,!!p.submit);
   delete p.data.registryCheck;
   if(p.submit)p.data.registryCheck=checkRegistryForRecord_(p.data);
   if(r&&!canEdit)throw Error('單號已使用，請以原本修改連結開啟；不能覆蓋他人單據');
   if(r&&r.lastRequest===p.requestId)return publicRecord_(r,true);
   if(r){FMSTW.checkVersion(r.version,p.version);if(r.signatures.length!==(p.signatureCount||0))throw Error('載入後已有新的簽章，請重新載入再修改');if(r.data.formType!==p.data.formType)throw Error('不能改變原單單別');}
   if(!/^[a-f0-9]{64}$/.test(p.editToken||'')||!/^[a-f0-9]{64}$/.test(p.createSignToken||''))throw Error('缺少安全存取碼');
   const next={data:p.data,version:r?r.version+1:1,editToken:r?r.editToken:p.editToken,signToken:p.createSignToken,signatures:[],pdf:null,status:p.submit?'待簽核':'草稿',lastRequest:p.requestId};
   const actor=p.adminToken?('管理者：'+admin_(p.adminToken)):(canEdit?'持修改碼者':'新填單者');
   return publicRecord_(persist_(next,hit,actor,'儲存內容；簽章重新開始'),true);
  }
  if(!r||(!canEdit&&!canSign))throw Error('單據不存在或存取碼無效');
  if(action==='pdf'&&!canEdit)throw Error('無修改權限');if(action==='sign'&&!canSign)throw Error('簽核碼無效');
  if(r.lastRequest===p.requestId)return publicRecord_(r,canEdit);
  FMSTW.checkVersion(r.version,p.version);
  if(r.status==='草稿')throw Error('請先送出單據');
  if(!/^JVBERi0[A-Za-z0-9+/=]*$/.test(String(p.b64||'')))throw Error('無效 PDF');
  if(action==='pdf'){if(r.signatures.length)throw Error('已簽版本不可替換原始 PDF');}
  else{
   if(p.expectedCount!==r.signatures.length||FMSTW.nextRole(r)!==p.role)throw Error('簽核進度已變更，請重新載入');
   if(!r.pdf)throw Error('尚無原始待簽 PDF');
   r.signatures.push({role:p.role,at:new Date().toISOString(),identity:'持簽核碼者（未驗證本人）'});
  }
  r.pdf={b64:p.b64,name:docNo+(action==='sign'?'_已簽'+p.role:'')+'.pdf'};r.lastRequest=p.requestId;
  r.status=FMSTW.nextRole(r)?'待簽核':'簽核完成';
  return publicRecord_(persist_(r,hit,action==='sign'?'持簽核碼者':'持修改碼者',action==='sign'?'提交簽章 '+p.role:'保存原始 PDF'),canEdit);
 }finally{lock.releaseLock();}
}
