'use strict';
(()=>{
 const mapping={GENERAL:['docNoG','staffName'],PE:['docNo','loName'],RE:['docNo','loName'],ADVANCE:['docNoA','loNameA'],ADVG:['docNoA','loNameA'],REFUND:['docNoR','staffR']};
 let generation=0,confirmation=null,timer=null;
 const panels=new Map();
 for(const id of new Set(Object.values(mapping).map(v=>v[0]))){
  const input=document.getElementById(id),panel=document.createElement('div');panel.className='registry-check';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');input.after(panel);panels.set(id,panel);
  input.addEventListener('input',()=>{generation++;confirmation=null;panel.hidden=true;panel.replaceChildren();clearTimeout(timer);timer=setTimeout(()=>lookup(id),900);});
  input.addEventListener('blur',()=>{clearTimeout(timer);lookup(id);});
 }
 function reset(){generation++;confirmation=null;clearTimeout(timer);for(const p of panels.values()){p.hidden=true;p.replaceChildren();}}
 const choose=chooseType;chooseType=function(t){reset();return choose(t);};
 function text(panel,message){panel.replaceChildren();const p=document.createElement('p');p.textContent=message;panel.append(p);panel.hidden=false;}
 async function lookup(id){
  const pair=mapping[formType];if(!pair||pair[0]!==id)return;
  const input=document.getElementById(id),code=input.value.trim().toUpperCase().replace(/\s/g,'');
  if(!code)return;
  if(confirmation&&confirmation.docNo===code)return;
  const panel=panels.get(id),type=formType,turn=++generation;input.value=code;
  if(!/^\d{3}[A-Z]+\d{1,6}$/.test(code)){text(panel,'單號格式需為年度＋類別＋流水號，例如 115EBA57。');return;}
  text(panel,'正在查核單號…');
  try{
   const result=await Service.rpc('lookupRegistry',{docNo:code});
   if(turn!==generation||formType!==type||input.value!==code)return;
   const messages={local_only:'本機試用尚未連接單號大表，請先自行確認姓名與單號。',not_configured:'尚未連接單號大表，請先自行確認姓名與單號。',invalid:'單號格式不正確，請確認。',year_mismatch:'單號年度與目前查核大表不同，請確認。',not_found:'大表查無此單號，請確認單號或洽財務。',unassigned:'此單號尚未登記領用人，請洽財務確認。',ambiguous:'大表有重複登記，請洽財務確認。'};
   if(result.status!=='found'){text(panel,messages[result.status]||'暫時無法查核，請自行確認。');return;}
   text(panel,'你是'+result.registeredName+'嗎？');
   const hint=document.createElement('small');hint.textContent=type==='PE'||type==='RE'?'這是大表登記的領用人；交換核銷仍由財務人工確認，不會自動判定一致。':'確認後才會帶入申請人姓名。這不是身分登入驗證。';panel.append(hint);
   const yes=document.createElement('button');yes.type='button';yes.textContent='是，帶入姓名';
   const no=document.createElement('button');no.type='button';no.textContent='不是，我自行填寫';
   const decide=answer=>{
    if(turn!==generation||formType!==type||input.value!==code)return;
    confirmation={docNo:code,registeredName:result.registeredName,answer,at:new Date().toISOString(),mode:['PE','RE'].includes(type)?'manual':'strict'};
    if(answer==='yes'){
     const name=document.getElementById(pair[1]);
     if(name.value.trim()&&name.value.trim()!==result.registeredName&&!confirm('目前姓名為「'+name.value+'」，要改成大表登記的「'+result.registeredName+'」嗎？')){confirmation=null;return;}
     name.value=result.registeredName;name.dispatchEvent(new Event('input',{bubbles:true}));
    }
    text(panel,answer==='yes'?'已帶入大表登記姓名。':'請自行填寫申請人姓名，財務將確認領用關係。');dirty=true;saveDraft(true);
   };
   yes.onclick=()=>decide('yes');no.onclick=()=>decide('no');panel.append(yes,no);
  }catch(e){if(turn===generation&&formType===type)text(panel,'單號查核失敗，請稍後重試或洽財務。');}
 }
 const collectBefore=collect;collect=function(){const d=collectBefore();return {...d,registryConfirmation:confirmation&&confirmation.docNo===d.docNo?confirmation:null};};
 const applyBefore=applyData;applyData=function(d){applyBefore(d);confirmation=null;const pair=mapping[formType];if(pair)lookup(pair[0]);};
 // Editing a name invalidates the earlier confirmation; do not retain a misleading "yes".
 document.addEventListener('input',e=>{const pair=mapping[formType];if(pair&&e.target.id===pair[1]&&confirmation&&e.target.value!==confirmation.registeredName){confirmation=null;const p=panels.get(pair[0]);text(p,'姓名已變更，請確認與單號領用人的關係。');}});
})();
