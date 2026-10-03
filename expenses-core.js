/* Shared pure rules: browser, Apps Script and isolated Node tests. No network. */
var ExpenseRules = (function () {
  'use strict';
  var categories = {fuel:'Carburant',parking:'Stationnement',service:'Frais de service',subscription:'Abonnement',maintenance:'Entretiens / réparations',other:'Autres frais'};
  function text(v) { return String(v == null ? '' : v).trim(); }
  function key(v) { return text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' '); }
  function plate(v) { return text(v).toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function date(v) { var s=text(v); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s) throw Error('Date invalide : '+s); return s; }
  function month(v) { if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(text(v))) throw Error('Mois requis au format AAAA-MM'); return text(v); }
  function cents(v) { if(v===''||v==null)return null; var s=text(v).replace(/\s/g,'').replace(',','.'); if(!/^-?\d+(\.\d{1,2})?$/.test(s))throw Error('Montant invalide (deux décimales maximum)'); var n=Math.round(Number(s)*100); if(!Number.isSafeInteger(n)||Math.abs(n)>1e11)throw Error('Montant hors limites'); return n; }
  function amounts(v) { var out={}; ['ht','vat','ttc'].forEach(function(k){var n=v[k]; if(n!==null&&(!Number.isSafeInteger(n)||Math.abs(n)>1e11))throw Error('Montant en centimes invalide');out[k]=n;}); if(out.ht===null&&out.ttc===null)throw Error('Renseigner au moins HT ou TTC'); if(out.ht!==null&&out.vat!==null&&out.ttc!==null&&out.ht+out.vat!==out.ttc)throw Error('HT + TVA différent du TTC'); return out; }
  function validate(input) {
    var inv={supplier:text(input.supplier),account:text(input.account),number:text(input.number),date:date(input.date),period:month(input.period),totals:amounts(input.totals||{}),note:text(input.note)};
    if(!['intermarche','easypark'].includes(inv.supplier)||!inv.account)throw Error('Fournisseur et compte client requis');
    if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw Error('De 1 à 100 opérations par facture');
    inv.lines=input.lines.map(function(l,i){
      if(!categories[l.category])throw Error('Catégorie inconnue');
      var r={id:String(i+1),category:l.category,date:l.date?date(l.date):'',month:l.date?date(l.date).slice(0,7):month(l.month||inv.period),amounts:amounts(l.amounts||{}),plate:plate(l.plate),personId:text(l.personId),externalId:text(l.externalId),card:text(l.card),fuelType:text(l.fuelType),label:text(l.label),sourcePerson:text(l.sourcePerson).slice(0,150),sourcePlate:plate(l.sourcePlate),transactionId:text(l.transactionId).slice(0,100),periodStart:l.periodStart?date(l.periodStart):'',periodEnd:l.periodEnd?date(l.periodEnd):'',amountOrigin:text(l.amountOrigin).slice(0,50),sourceKm:text(l.sourceKm).slice(0,20),taxRate:l.taxRate==null?null:Number(l.taxRate),scope:l.scope==='common'?'common':'unassigned',maintenanceId:text(l.maintenanceId),litres:l.litres===''||l.litres==null?null:Number(l.litres)};
      if(r.scope==='common'&&(r.plate||r.personId))throw Error('Les frais communs ne peuvent pas être affectés');
      if(r.plate||r.personId)r.scope='assigned';
      if(r.litres!==null&&(!Number.isFinite(r.litres)||Math.abs(r.litres)>1e6||r.category!=='fuel'))throw Error('Litres invalides ou hors carburant');
      return r;
    });
    ['ht','vat','ttc'].forEach(function(k){if(inv.totals[k]!==null){if(inv.lines.some(function(l){return l.amounts[k]===null;}))throw Error('Montant '+k.toUpperCase()+' manquant sur une opération');var sum=inv.lines.reduce(function(s,l){return s+l.amounts[k];},0);if(sum!==inv.totals[k])throw Error('Écart '+k.toUpperCase()+' : '+((sum-inv.totals[k])/100).toFixed(2)+' €');}});
    if(inv.note.length>1000||JSON.stringify(inv).length>38000)throw Error('Facture trop volumineuse');
    return inv;
  }
  function identity(i) { return [key(i.supplier),key(i.account),key(i.number)].join('|'); }
  function fallback(i) { return [key(i.supplier),key(i.account),i.date,i.period,JSON.stringify(i.totals)].join('|'); }
  function duplicate(candidate,existing) { return existing.find(function(i){return i.id!==candidate.id&&(i.documents.some(function(d){return candidate.documents.some(function(c){return c.hash===d.hash;});})||(candidate.number&&i.number&&identity(i)===identity(candidate))||(!candidate.number&&!i.number&&fallback(i)===fallback(candidate)));}); }
  function mapped(line,invoice,mappings) { var start=line.date||line.periodStart,end=line.date||line.periodEnd;if(!start||!end)return line;var r=Object.assign({},line); mappings.filter(function(m){return m.supplier===invoice.supplier&&key(m.account)===key(invoice.account)&&start>=m.from&&(!m.to||end<=m.to)&&((m.kind==='card'&&key(m.source)===key(line.card))||(m.kind==='user'&&key(m.source)===key(line.externalId)));}).forEach(function(m){if(assignmentKind(r)!=='driver'&&m.plate&&!r.plate)r.plate=m.plate;if(assignmentKind(r)!=='vehicle'&&m.personId&&!r.personId)r.personId=m.personId;});return r; }
  function assignmentKind(l) { return ['fuel','parking'].includes(l.category)?'driver':l.category==='maintenance'?'vehicle':'either'; }
  function needsAssignment(l) { return l.scope!=='common'&&(assignmentKind(l)==='driver'?!l.personId:assignmentKind(l)==='vehicle'?!l.plate:!l.plate&&!l.personId); }
  function select(invoices,filter) { var out=[];invoices.filter(function(i){return i.status!=='cancelled';}).forEach(function(i){i.lines.forEach(function(l){if(filter.annual?!l.month.startsWith(filter.month.slice(0,4)):l.month!==filter.month)return;if(filter.plate&&(assignmentKind(l)==='driver'||l.plate!==plate(filter.plate)))return;if(filter.personId&&(assignmentKind(l)==='vehicle'||l.personId!==filter.personId))return;if(filter.category&&l.category!==filter.category)return;if(filter.unassigned&&!needsAssignment(l))return;out.push(Object.assign({invoiceId:i.id,supplier:i.supplier,number:i.number},l));});});return out; }
  function summary(lines,basis) {var total=0,missing=0,litres=0;lines.forEach(function(l){if(l.amounts[basis]===null)missing++;else total+=l.amounts[basis];if(l.litres!==null)litres+=l.litres;});return {total:total,missing:missing,litres:litres};}
  return {categories:categories,key:key,plate:plate,date:date,month:month,cents:cents,validate:validate,identity:identity,fallback:fallback,duplicate:duplicate,mapped:mapped,select:select,summary:summary,needsAssignment:needsAssignment,assignmentKind:assignmentKind};
})();
if(typeof module!=='undefined')module.exports=ExpenseRules;
