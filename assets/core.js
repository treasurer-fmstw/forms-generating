/* Shared pure rules; used by browser, Apps Script and Node tests. */
(function(root){
'use strict';
const types={
 GENERAL:{label:'一般核銷',roles:['部長','副會長','會長','財務長'],layout:'general'},
 PE:{label:'SCOPE 專業交換',roles:['LO','NO','財務長'],layout:'exchange'},
 RE:{label:'SCORE 研究交換',roles:['LO','NO','財務長'],layout:'exchange'},
 ADVANCE:{label:'預支單（SCOPE／SCORE）',roles:['LO','NO','財務長'],layout:'advance'},
 ADVG:{label:'經費預支單',roles:['部長/申請人','副會長/秘書長','會長','財務長'],layout:'advance'},
 REFUND:{label:'退費申請單',roles:[],layout:'refund'}
};
function parseDocNo(value){
 const code=String(value||'').trim().toUpperCase().replace(/\s/g,'');
 const m=code.match(/^(\d{3})([A-Z]{3})(\d+)$/);
 if(!m||code.length>48||!Number.isSafeInteger(Number(m[3])))return null;
 return {code,year:m[1],sheetName:m[2],number:Number(m[3])};
}
function amount(value,label='金額'){
 const n=Number(value==null||value===''?0:value);
 if(!Number.isSafeInteger(n)||n<0||n>999999999) throw Error(label+'須為 0 至 999,999,999 的整數');
 return n;
}
function totals(r){
 const total=(r.items||[]).reduce((s,i)=>s+amount(i.amt,'明細金額'),0);
 amount(total,'支出總額');
 const claim=r.claimAmount==null||r.claimAmount===''?total:amount(r.claimAmount,'申請核銷金額');
 const drawn=amount(r.advanceDrawn,'預支'),prepaid=amount(r.prepaid,'代收／預收');
 return {total,claim,excluded:total-claim,net:claim-drawn-prepaid,drawn,prepaid,paid:amount(r.outOfPocket,'已墊付')};
}
function summary(r){
 const t=totals(r);return t.net>0?'本會應撥付 '+t.net.toLocaleString('en-US')+' 元':t.net<0?'應繳回 '+(-t.net).toLocaleString('en-US')+' 元':'結清';
}
function validate(r,submit=false){
 if(!r||!types[r.formType]) throw Error('請選擇有效單別');
 if(!parseDocNo(r.docNo))throw Error('單號須為 3 位年度＋3 個英文字母＋流水號');
 const t=totals(r),layout=types[r.formType].layout;
 const required=(key,label)=>{if(!String(r[key]||'').trim()) throw Error('請填寫'+label);};
 if(submit){
  if(layout==='advance'){
   required('adminUse','用途');required('loName','申請人姓名');required('dept','部門／職稱');required('planCode','計畫編號');required('phone2','連絡電話');
   if(r.formType==='ADVANCE') required('loSchool','LO 學校');
   if(!amount(r.advanceAmount,'預支金額')) throw Error('預支金額須大於零');
  }else if(layout==='refund'){
   for(const [k,l] of [['eventName','活動名稱'],['refundReason','退費原因'],['staffName','負責幹部'],['dept','部門'],['phone2','連絡電話']])required(k,l);
   if(!['整筆退給負責幹部','分別退給報名者'].includes(r.refundMode)) throw Error('請選擇退費方式');
   if(r.refundMode==='分別退給報名者'){
    if(!(r.refunds||[]).length) throw Error('請填寫退費明細');
    let total=0;
    for(const p of r.refunds){for(const k of ['name','bank','bankCode','branch','acctNo','acctName']) if(!String(p[k]||'').trim())throw Error('退費明細的姓名及帳戶欄位未填完整');total+=amount(p.amt,'退費金額');}
    if(total!==amount(r.refundTotal))throw Error('退費明細與總額不一致');
   }
   if(!amount(r.refundTotal,'退費金額'))throw Error('退費總額須大於零');
  }else{
   if(!(r.items||[]).length)throw Error('請至少填一筆明細');
   for(const it of r.items){if(!String(it.item||'').trim()||!String(it.use||'').trim())throw Error('每筆明細須填項目及用途');if(!amount(it.amt))throw Error('明細金額須大於零');}
   if(t.claim>t.total)throw Error('申請核銷金額不可大於實際支出');
   if(t.excluded>0&&!String(r.claimNote||'').trim())throw Error('請填寫不申請核銷差額的說明');
   if(t.paid!==t.total) throw Error('此版尚未支援「已墊付與支出總額不同」的結算，請先確認付款情境');
   required('budgetCode','預算科目');required('budgetName','預算名稱');
   if(layout==='general'){
    required('deptTitle','部門職稱');required('staffName','幹部姓名');
    if(!['A','P'].includes(r.expenseType))throw Error('請選擇行政或計畫支出');
    required(r.expenseType==='P'?'projectName':'adminType',r.expenseType==='P'?'計畫名稱':'行政支出別');
   }else{required('loName','LO 姓名');required('loSchool','LO 學校');required('kind','核銷種類');required('dept','部門');}
   if(r.payeeName){for(const [k,l]of [['payeeId','身分證字號'],['payeeReason','領據事由'],['addr1','戶籍地址'],['phone','電話'],['signature','具領人簽章']])required(k,l);}
  }
  if(!(layout==='refund'&&r.refundMode==='分別退給報名者')){
   for(const [k,l]of [['acctName','戶名'],['bank','銀行'],['bankCode','銀行代碼'],['branch','分行'],['acctNo','帳號']])required(k,l);
  }
 }
 // Only browser-produced raster images may reach renderers; prevent URL / HTML injection.
 const image=v=>{if(v&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v))throw Error('附件影像格式不支援');};
 image(r.passbook);image(r.signature);
 for(const it of r.items||[]){image(it.img);for(const v of it.imgs||[])image(v);}
 for(const p of r.refunds||[])image(p.passbook);
 return t;
}
function nextRole(record){const roles=types[record.data.formType].roles;return roles[(record.signatures||[]).length]||'';}
function checkVersion(current,expected){if(current!==expected)throw Error('資料已被其他人更新，請先重新載入；本次修改尚未覆蓋');}
root.FMSTW={types,parseDocNo,amount,totals,summary,validate,nextRole,checkVersion};
if(typeof module!=='undefined')module.exports=root.FMSTW;
})(globalThis);
