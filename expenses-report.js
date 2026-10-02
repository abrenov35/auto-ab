/* Reporting only: shared journal remains the source of truth. */
var ExpenseReport=(function(){
 'use strict';
 const R=typeof ExpenseRules!=='undefined'?ExpenseRules:require('./expenses-core');
 function shift(month,offset){R.month(month);const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+offset,1));return d.toISOString().slice(0,7);}
 function months(f){return f.annual?Array.from({length:Number(f.month.slice(5))},(_,i)=>f.month.slice(0,4)+'-'+String(i+1).padStart(2,'0')):[f.month];}
 function select(data,f){const allowed=new Set(months(f));return R.select(data.invoices,f).filter(l=>allowed.has(l.month));}
 function status(data,f,today){
  const sources=f.category==='fuel'?['intermarche']:['parking','service','subscription'].includes(f.category)?['easypark']:['intermarche','easypark'];
  const lines=select(data,f),sum=R.summary(lines,'ht'),reasons=[];
  for(const month of months(f)){
   if(month>=today.slice(0,7))reasons.push('Période en cours ou future');
   for(const supplier of sources){
    const accounts=[...new Set([...data.invoices.filter(i=>i.supplier===supplier).map(i=>R.key(i.account)),...Object.values(data.completion).filter(c=>c.supplier===supplier).map(c=>R.key(c.account))])];
    if(!accounts.length)reasons.push('Factures attendues à renseigner');
    for(const a of accounts)if(data.completion[supplier+'|'+a+'|'+month]?.status!=='Validé')reasons.push('Imports non validés');
   }
  }
  if(sum.missing)reasons.push('Montants HT manquants');
  if(f.plate||f.personId){const wider=select(data,{...f,plate:'',personId:'',unassigned:false});if(wider.some(l=>l.scope!=='common'&&((f.plate&&!l.plate)||(f.personId&&!l.personId))))reasons.push('Affectations incomplètes');}
  if(f.unassigned)reasons.push('Vue limitée aux opérations à affecter');
  return {complete:!reasons.length,reasons:[...new Set(reasons)],lines,sum};
 }
 function compare(data,f,offset,today){const current=status(data,f,today),previous=status(data,{...f,month:shift(f.month,offset)},today);const eligible=current.complete&&previous.complete;const delta=current.sum.total-previous.sum.total;return {current,previous,eligible,delta:eligible?delta:null,percent:eligible&&previous.sum.total>0?delta/previous.sum.total*100:null};}
 function trend(data,f,today){return Array.from({length:12},(_,i)=>{const month=shift(f.month,i-11);return {month,...status(data,{...f,month,annual:false},today)};});}
 function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(rows){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');}
 // Small, dependency-free PDF, A4 landscape, Helvetica with WinAnsi encoding.
 // Every input is a text operand; parentheses and backslashes are escaped.
 function pdf(lines){
  const latin=s=>String(s).replace(/[–—−]/g,'-').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/€/g,'EUR').replace(/\u202f|\u00a0/g,' ').replace(/[^\x20-\xff]/g,'?');
  const escape=s=>latin(s).replace(/([\\()])/g,'\\$1');
  const wrapped=lines.flatMap(s=>{s=latin(s);const out=[];while(s.length>130){let cut=s.lastIndexOf(' ',130);if(cut<40)cut=130;out.push(s.slice(0,cut));s=s.slice(cut).trimStart();}out.push(s);return out;});
  const pages=[];for(let i=0;i<wrapped.length;i+=40)pages.push(wrapped.slice(i,i+40));if(!pages.length)pages.push(['Aucune opération']);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];const kids=[];
  pages.forEach((rows,i)=>{const pageId=objects.length+1,contentId=pageId+1;kids.push(pageId+' 0 R');const stream='BT /F1 9 Tf 35 555 Td 13 TL '+rows.concat(['', 'Page '+(i+1)+' / '+pages.length]).map((s,j)=>(j?'T* ':'')+'('+escape(s)+') Tj').join('\n')+' ET';objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents '+contentId+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');});
  objects[1]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages.length+' >>';let file='%PDF-1.4\n',offsets=[0];objects.forEach((s,i)=>{offsets.push(file.length);file+=(i+1)+' 0 obj\n'+s+'\nendobj\n';});const xref=file.length;file+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Uint8Array.from(file,c=>c.charCodeAt(0));
 }
 return {shift,months,select,status,compare,trend,csv,pdf};
})();
if(typeof module!=='undefined')module.exports=ExpenseReport;
