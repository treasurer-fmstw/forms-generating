/** Read-only single-number lookup. Configure private Script Properties; never copy the roster into web/. */
function lookupRegistry_(p){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty('MASTER_SHEET_ID'),year=props.getProperty('MASTER_YEAR');
 if(!id||!year)return {status:'not_configured'};
 const code=String(p.docNo||'').trim().toUpperCase().replace(/\s/g,'');
 const m=code.match(/^(\d{3})([A-Z]+)(\d{1,6})$/);
 if(!m)return {status:'invalid',docNo:code};
 if(m[1]!==year)return {status:'year_mismatch',docNo:code};
 try{
  const sheets=SpreadsheetApp.openById(id).getSheets().filter(s=>s.getName().trim().toUpperCase()===m[2]);
  if(sheets.length!==1)return {status:sheets.length?'ambiguous':'not_found',docNo:code};
  const data=sheets[0].getDataRange().getDisplayValues(),matches=[];
  for(let row=0;row<data.length-1;row++){
   if(String(data[row][0]).replace(/\s/g,'')!=='單號'||String(data[row+1][0]).replace(/\s/g,'')!=='姓名')continue;
   for(let col=1;col<data[row].length;col++){
    const raw=String(data[row][col]).trim();
    if(!/^\d+$/.test(raw)||Number(raw)!==Number(m[3]))continue;
    matches.push(String(data[row+1][col]||'').trim());
   }
  }
  if(!matches.length)return {status:'not_found',docNo:code};
  if(matches.length!==1)return {status:'ambiguous',docNo:code};
  if(!matches[0])return {status:'unassigned',docNo:code};
  return {status:'found',docNo:code,registeredName:matches[0].slice(0,200)};
 }catch(e){throw Error('單號查核暫時無法讀取，請通知管理者確認大表存取權。');}
}
function checkRegistryForRecord_(rec){
 const found=lookupRegistry_({docNo:rec.docNo});
 const mode=['PE','RE'].includes(rec.formType)?'manual':'strict';
 const submittedName=String(['GENERAL','REFUND'].includes(rec.formType)?rec.staffName||'':rec.loName||'');
 return {status:found.status,mode,checkedAt:new Date().toISOString(),
  registeredName:found.registeredName||'',
  nameMatch:found.status==='found'&&mode==='strict'?submittedName.replace(/\s+/g,'')===found.registeredName.replace(/\s+/g,''):null};
}
