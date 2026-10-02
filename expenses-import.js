/* Format-specific readers. OCR candidates always require human verification.
 * No invoice contents, account IDs or names from real samples are embedded here. */
var ExpenseImport=(function(){
'use strict';
const money=s=>{const n=String(s||'').replace(/\s/g,'').replace(',','.');return /^-?\d+\.\d{2}$/.test(n)?Math.round(Number(n)*100):null;};
const decimal=s=>Number(String(s).replace(',','.'));
const date=s=>{const m=String(s).match(/(\d{2})[./](\d{2})[./](\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:'';};
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[−–—]/g,'-').replace(/~(?=\d)/g,'-').replace(/%\s*=\s*/g,'% ');
function base(supplier){return {supplier,account:'',number:'',date:'',period:'',totals:{ht:null,vat:null,ttc:null},note:'',lines:[]};}
function line(extra){return Object.assign({category:'other',date:'',month:'',label:'',plate:'',personId:'',scope:'unassigned',externalId:'',card:'',fuelType:'',litres:null,maintenanceId:'',amounts:{ht:null,vat:null,ttc:null},sourcePerson:'',sourcePlate:'',transactionId:'',periodStart:'',periodEnd:'',amountOrigin:'printed',sourceKm:''},extra);}
function diagnostic(invoice,warnings,sourceTotal){
 const missing=invoice.lines.filter(l=>l.amounts.ht===null).length;
 const sum=invoice.lines.reduce((s,l)=>s+(l.amounts.ht||0),0);
 if(!invoice.account)warnings.push('Compte client non reconnu.');if(!invoice.number)warnings.push('Numéro de facture non reconnu.');if(!invoice.date)warnings.push('Date de facture non reconnue.');
 if(missing)warnings.push(missing+' montant(s) HT non reconnu(s).');
 if(invoice.totals.ht===null)warnings.push('Total HT du document non reconnu.');
 if(invoice.totals.ht!==null&&sum!==invoice.totals.ht)warnings.push('Écart entre opérations et total HT : '+((sum-invoice.totals.ht)/100).toFixed(2)+' €. Aucun équilibrage automatique.');
 return {invoice,warnings:[...new Set(warnings)],sourceTotal,requiresReview:true,balanced:!missing&&invoice.totals.ht!==null&&sum===invoice.totals.ht};
}
function intermarche(pages){
 const text=norm(pages.join('\n')),rows=text.split('\n'),i=base('intermarche'),warnings=[];
 i.account=(text.match(/Votre\s+n[o°]\s+de\s+client\s+(\d+)/i)||[])[1]||'';
 i.number=(text.match(/Numero\s+de\s+facture\s+(\d+)/i)||[])[1]||'';
 i.date=date((text.match(/Date\s+de\s+la\s+facture\s+(\d{2}\/\d{2}\/\d{4})/i)||[])[1]);i.period=i.date.slice(0,7);
 let group=[],fuelCheck=null;const cardSums=new Map(),printedCards=new Map();
 for(const raw of rows){const r=raw.trim();
  const tx=r.match(/^(\d{7})\s+(\d{2}\/\d{2}\/\d{4})\s+.*?\d{2}:\d{2}\s+.*?\s+\d{4}\s+(\d+)\.?\s+_?B[7T]\s+GAZOLE\.?\s+([\d.,]+)\s+[\d.,]+\s+([\d.,]+)\s+([\d.,]+)\s*$/i);
  if(tx){const rate=decimal(tx[5]),ttc=money(tx[6]);if(ttc===null||!Number.isFinite(rate)){warnings.push('Montant ou taux illisible sur une opération.');continue;}const ht=Math.round(ttc*100/(100+rate));
   const l=line({category:'fuel',date:date(tx[2]),month:date(tx[2]).slice(0,7),card:tx[1],fuelType:'B7 GAZOLE',litres:decimal(tx[4]),sourceKm:tx[3],label:'B7 GAZOLE · carte '+tx[1],amounts:{ht,vat:ttc-ht,ttc},amountOrigin:'calculated_from_printed_rate',taxRate:rate});if(/BT\s+GAZOLE/i.test(r)){l.fuelType='BT GAZOLE (lecture à vérifier)';warnings.push('Un type de carburant est lu BT : vérifier sur le justificatif.');}i.lines.push(l);group.push(l);cardSums.set(tx[1],(cardSums.get(tx[1])||0)+ttc);continue;
  }
  if(/^\d{7}\s+\d{2}\/\d{2}\/\d{4}/.test(r))warnings.push('Opération carburant non reconnue : compléter depuis le justificatif.');
  const card=r.match(/^Sous Total Carte\s+(\d+)\s+.*?\s+([\d.,]+)$/i);if(card)printedCards.set(card[1],money(card[2]));
  const name=r.match(/^Sous Total\s+(?!Carte)(.+?)\s+\d+[.,]\d{2}$/i);if(name){group.forEach(l=>l.sourcePerson=name[1]);group=[];}
  const fee=r.match(/^(Frais de Gestion|Pack services et assurance vol)\s+(?:\d+\s+)?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i);
  if(fee){const ht=money(fee[2]),ttc=money(fee[4]);i.lines.push(line({category:'service',month:i.period,scope:'common',label:fee[1],amounts:{ht,vat:ttc-ht,ttc}}));}
  const summary=r.match(/^B7\s+gazole\s+[\d.,]+\s+([\d.,]+)\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i);if(summary)fuelCheck={litres:decimal(summary[1]),ht:money(summary[2]),ttc:money(summary[4])};
  const total=r.match(/^Total\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*$/);if(total)i.totals={ht:money(total[1]),vat:money(total[2]),ttc:money(total[3])};
 }
 for(const [card,total] of printedCards)if(cardSums.get(card)!==total)warnings.push('Sous-total de carte non rapproché : '+card);
 if(!fuelCheck)warnings.push('Synthèse carburant non reconnue.');else{const fuels=i.lines.filter(l=>l.category==='fuel');if(Math.abs(fuels.reduce((s,l)=>s+l.litres,0)-fuelCheck.litres)>.005||fuels.reduce((s,l)=>s+l.amounts.ht,0)!==fuelCheck.ht||fuels.reduce((s,l)=>s+l.amounts.ttc,0)!==fuelCheck.ttc)warnings.push('La synthèse carburant ne correspond pas aux opérations.');}
 if(!i.lines.length)warnings.push('Aucune opération reconnue.');
 i.note='HT carburant calculé au taux imprimé sur chaque opération ; frais communs séparés. Véhicules à affecter par carte. Kilométrages lus non intégrés à l’historique.';
 warnings.push('Vérifier chaque montant HT calculé et les affectations carte-véhicule.');
 return diagnostic(i,warnings,'printed');
}
function easypark(pages){
 // Retain continuation rows across page boundaries; discard corporate footers only.
 const cleaned=pages.map(p=>norm(p).split('\n').filter((r,index,rows)=>{const footer=rows.findIndex(x=>/^Adresse\s+Numero de TVA/i.test(x.trim()));return footer<0||index<footer;}).join('\n'));
 const text=cleaned.join('\n'),i=base('easypark'),warnings=[];
 i.number=(text.match(/Reference facture:\s*(\d+)/i)||[])[1]||'';i.account=(text.match(/Numero client:\s*(\d+)/i)||[])[1]||'';
 i.date=date((text.match(/Date:\s*(\d{2}\.\d{2}\.\d{4})/i)||[])[1]);
 const period=(text.match(/Periode:\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/i)||[]);i.period=date(period[1]).slice(0,7);
 let person='',phone='',current=null,printedTotal=0,subtotalCount=0;
 const flush=()=>{if(!current)return;const raw=current.rows.join(' '),kind=current.kind,amount=raw.match(/(-?\d+[,.]\d{2})\s*EUR\s+(\d+(?:[,.]\d+)?)%\s+(-?\d+[,.]\d{2})\s*EUR\s+(-?\d+(?:[,.]\d{2})?)/);
   const dates=[...raw.matchAll(/\d{2}\.\d{2}\.\d{4}/g)].map(m=>date(m[0]));
   const phoneId=current.phone,tx=raw.match(/Transaction ID:\s*([01O])-FR-(EP|\d+)-\s*(\d*)/i);let transactionId=tx?[tx[1].toUpperCase()==='O'?'0':tx[1],'FR',tx[2],tx[3]].join('-'):'';
   // Service transaction numbers can wrap into the next visual line, after amounts.
   if(tx&&!tx[3]){const continuation=raw.match(/(?:-?\d+(?:[,.]\d{2})?)\s+(\d{8})\s+(?:Premium|\d{2}\.\d{2}\.\d{4})/);if(continuation)transactionId+=continuation[1];}
   if(tx&&!tx[3]&&kind==='parking'){const wrapped=current.rows.join('\n').match(/Transaction ID:[^\n]*\n\s*(\d{6,})/);if(wrapped)transactionId+=wrapped[1];}
   const plate=(raw.match(/Plaque d'immatriculation:\s*(?:Code de zone:\s*\d+\s*)?([A-Z]{2}\d{3}[A-Z]{2})/i)||[])[1]||current.rows.map(x=>x.trim()).find(x=>/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(x))||'';
   const ht=amount?money(amount[1]):null,vat=amount?money(amount[3]):null,ttc=amount?money(amount[4]):null;
   if(!amount)warnings.push('Une opération ne comporte pas de montant HT lisible.');
   if(!transactionId||transactionId.endsWith('-'))warnings.push('Identifiant de transaction incomplet.');
   const category=kind==='parking'?'parking':/inscription/i.test(raw)?'service':'subscription';
   const l=line({category,date:kind==='parking'?(dates[0]||''):'',month:(dates[0]||i.period).slice(0,7),label:kind==='parking'?'Stationnement':/Remise/i.test(raw)?'Remise abonnement':category==='service'?'Frais d’inscription':'Abonnement EasyPark',externalId:phoneId,sourcePerson:current.person,sourcePlate:plate.toUpperCase(),transactionId,periodStart:dates[0]||'',periodEnd:dates[1]||dates[0]||'',amounts:{ht,vat,ttc}});
   if(l.periodStart&&l.periodEnd&&l.periodStart.slice(0,7)!==l.periodEnd.slice(0,7)&&kind!=='parking')warnings.push('Service couvrant plusieurs mois : ventilation à vérifier.');
   i.lines.push(l);current=null;
 };
 for(const raw of text.split('\n')){const r=raw.trim();
  const user=r.match(/^([^:]+?),\s*(\+33\d{9}),?\s*$/);if(user){flush();person=user[1];phone=user[2];continue;}
  const total=r.match(/^Total\s+.+?,\s*\+33\d{9}:\s*(-?\d+[,.]\d{2})\s*EUR/);if(total){flush();printedTotal+=money(total[1]);subtotalCount++;continue;}
  const start=r.match(/^\d+[.,]\s*(Debut\s*:|Transaction ID:)/i);if(start){flush();current={kind:/Debut/i.test(start[1])?'parking':'service',rows:[r],person,phone};continue;}
  if(/^Montant (service|des stationnements)/i.test(r)){flush();continue;}
  if(current)current.rows.push(r);
 }
 flush();
 const adjustment=text.match(/Ajustement[^\n]*?Montant\s*\(HT\):\s*(-?\d+[,.]\d{2})\s*EUR\s*(-?\d+[,.]\d{2})\s*\nTVA:\s*(-?\d+[,.]\d{2})\s*EUR/i);
 if(adjustment){const ht=money(adjustment[1]);i.lines.push(line({category:'other',month:i.period,scope:'common',label:'Ajustement d’arrondi imprimé',amounts:{ht,vat:money(adjustment[3]),ttc:money(adjustment[2])}}));printedTotal+=ht;}
 else if(/Ajustement/i.test(text))warnings.push('Ajustement imprimé non reconnu : compléter explicitement.');
 i.totals={ht:subtotalCount?printedTotal:null,vat:null,ttc:null};
 i.note='Total HT reconstitué depuis les sous-totaux nominatifs imprimés et l’ajustement explicite. Stationnements classés par date de début ; abonnements par période de service. À vérifier avec le récapitulatif de facture.';
 warnings.push('Total HT reconstitué : vérifier le récapitulatif de facture.','Les abonnements peuvent concerner un autre mois que la facture.');
 const knownIds=i.lines.map(l=>l.transactionId).filter(Boolean);if(new Set(knownIds).size!==knownIds.length)warnings.push('Identifiants de transaction répétés : vérifier les pages jointes.');
 return diagnostic(i,warnings,'printed_subtotals');
}
function parse(supplier,pages){if(!Array.isArray(pages)||!pages.length)throw Error('Document vide');const full=norm(pages.join('\n'));const ids=[...full.matchAll(supplier==='intermarche'?/Numero\s+de\s+facture\s+(\d+)/gi:/Reference facture:\s*(\d+)/gi)].map(m=>m[1]);if(new Set(ids).size>1)throw Error('Plusieurs factures différentes détectées. Importez une facture à la fois.');return supplier==='intermarche'?intermarche(pages):supplier==='easypark'?easypark(pages):(()=>{throw Error('Fournisseur non pris en charge');})();}
return {parse};
})();
if(typeof module!=='undefined')module.exports=ExpenseImport;
