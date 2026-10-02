/* Append-only journal. Copy this file AND expenses-core.js as .gs files into GAS.
 * All calls enter AFTER verifierSessionParc_. No new sharing permissions. */
function depEvents_(ss) {
  var sh=ss.getSheetByName('Dépenses journal');
  if(!sh||sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,1).getValues().map(function(r){return JSON.parse(r[0]);});
}
function depSnapshot_(events) {
  var invoices={},people={},mappings={},completion={};
  events.forEach(function(e){
    if(e.type==='invoice'){var previous=invoices[e.value.id];Object.keys(completion).forEach(function(k){if(k.startsWith(e.value.supplier+'|'+ExpenseRules.key(e.value.account)+'|')||(previous&&k.startsWith(previous.supplier+'|'+ExpenseRules.key(previous.account)+'|')))delete completion[k];});invoices[e.value.id]=e.value;}
    if(e.type==='person')people[e.value.id]=e.value;
    if(e.type==='mapping')mappings[e.value.id]=e.value;
    if(e.type==='completion')completion[e.value.key]=e.value;
  });
  return {invoices:Object.values(invoices),people:Object.values(people),mappings:Object.values(mappings),completion:completion,audit:events.filter(function(e){return e.type==='invoice';}).map(function(e){return {id:e.value.id,at:e.at,revision:e.value.revision,reason:e.reason,status:e.value.status,actor:e.actor};})};
}
function depAppend_(ss,event) {
  var payload=JSON.stringify(event);if(payload.length>45000)throw Error('Enregistrement trop volumineux');
  var sh=ss.getSheetByName('Dépenses journal');
  if(!sh){
    var props=PropertiesService.getScriptProperties();
    if(!props.getProperty('AUTO_AB_DEPENSES_BACKUP')){
      var copy=DriveApp.getFileById(CONFIG.SHEET_ID).makeCopy('AB Auto avant Dépenses '+nowIso_(),DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID));
      props.setProperty('AUTO_AB_DEPENSES_BACKUP',copy.getId());
    }
    sh=ss.insertSheet('Dépenses journal');sh.getRange(1,1).setValue('Événement JSON v1');
  }
  sh.getRange(sh.getLastRow()+1,1).setValue(payload);SpreadsheetApp.flush();
}
function depDocument_(d,requestId,index) {
  if(!d||!d.base64||!['application/pdf','image/jpeg','image/png'].includes(d.mime))throw Error('Justificatif PDF/JPG/PNG requis');
  if(d.base64.length>7*1024*1024)throw Error('Justificatif limité à 5 Mo');
  var bytes=Utilities.base64Decode(d.base64);
  if(!bytes.length||bytes.length>5*1024*1024)throw Error('Justificatif vide ou trop grand');
  var b=bytes.map(function(v){return (v+256)%256;});
  if((d.mime==='application/pdf'&&!(b[0]===37&&b[1]===80&&b[2]===68&&b[3]===70))||(d.mime==='image/jpeg'&&!(b[0]===255&&b[1]===216))||(d.mime==='image/png'&&!(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)))throw Error('Contenu du justificatif incompatible avec son format');
  var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2);}).join('');
  return {hash:hash,name:String(d.name||'Justificatif').slice(0,180),mime:d.mime,bytes:bytes,storageName:'dep-'+requestId+'-'+index+'-'+hash};
}
function depCheckLinks_(i,snapshot,ss) {
  var vehicles=lireVehicules_(ss),maintenance=lireMaintenance_(ss),used={};
  snapshot.invoices.filter(function(x){return x.id!==i.id&&x.status!=='cancelled';}).forEach(function(x){x.lines.forEach(function(l){if(l.maintenanceId)used[l.maintenanceId]=true;});});
  i.lines.forEach(function(l){
    if(l.personId&&!snapshot.people.some(function(p){return p.id===l.personId;}))throw Error('Personne inconnue : utiliser un identifiant enregistré');
    if(l.plate&&!vehicles.some(function(v){return ExpenseRules.plate(v.immatriculation)===l.plate;}))throw Error('Véhicule inconnu');
    if(l.maintenanceId){if(used[l.maintenanceId])throw Error('Entretien déjà lié à une opération');var m=maintenance.find(function(x){return String(x.id)===l.maintenanceId;});if(!m||l.category!=='maintenance'||ExpenseRules.plate(m.immatriculation)!==l.plate)throw Error('Lien entretien invalide');used[l.maintenanceId]=true;}
  });
}
function depHandle_(ss,p) {
  if(p.action==='readExpenses')return jsonResponse_(Object.assign({ok:true,version:1},depSnapshot_(depEvents_(ss))));
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(String(p.requestId||'')))throw Error('Identifiant de requête requis');
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    var events=depEvents_(ss),prior=events.find(function(e){return e.requestId===p.requestId;});
    if(prior)return jsonResponse_({ok:true,id:prior.value.id,replayed:true});
    var snap=depSnapshot_(events),value,type;
    if(p.action==='saveExpenseInvoice') {
      value=ExpenseRules.validate(p.invoice);value.id=p.invoice.id||Utilities.getUuid();
      var old=snap.invoices.find(function(i){return i.id===value.id;});
      if(old&&old.revision!==p.expectedRevision)throw Error('Facture modifiée ailleurs. Actualisez avant de corriger.');
      if(p.invoice.id&&!old)throw Error('Facture introuvable');
      if(old&&old.status==='cancelled')throw Error('Facture annulée : correction impossible');
      if(old&&!String(p.reason||'').trim())throw Error('Motif de correction requis');
      var docs=(p.documents||[]).map(function(d,index){return depDocument_(d,p.requestId,index);});
      if(old&&docs.length)throw Error('Les justificatifs d’une facture enregistrée sont conservés');
      if(!old&&(docs.length<1||docs.length>2))throw Error('Joindre la facture et éventuellement son relevé');
      value.documents=old?old.documents:docs.map(function(d){return {hash:d.hash,name:d.name};});
      if(ExpenseRules.duplicate(value,snap.invoices))throw Error('Doublon possible : document, numéro ou justificatif sans numéro déjà enregistré, même annulé');
      depCheckLinks_(value,snap,ss);
      value.revision=old?old.revision+1:1;value.status='active';
      // Reject oversized events before creating files. The invoice is one atomic journal row.
      if(JSON.stringify(value).length>42000)throw Error('Facture trop volumineuse');
      if(!old){var folder=DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);value.documents=docs.map(function(d){
        var found=folder.getFilesByName(d.storageName);var file=found.hasNext()?found.next():folder.createFile(Utilities.newBlob(d.bytes,d.mime,d.storageName));
        return {id:file.getId(),url:file.getUrl(),name:d.name,hash:d.hash,mime:d.mime};
      });}
      type='invoice';
    } else if(p.action==='cancelExpenseInvoice') {
      var existing=snap.invoices.find(function(i){return i.id===p.id;});
      if(!existing||existing.revision!==p.expectedRevision)throw Error('Facture introuvable ou modifiée ailleurs');
      if(!String(p.reason||'').trim())throw Error('Motif d’annulation requis');
      value=Object.assign({},existing,{revision:existing.revision+1,status:'cancelled'});type='invoice';
    } else if(p.action==='saveExpensePerson') {
      if(!String(p.name||'').trim()||!String(p.reference||'').trim())throw Error('Nom complet et référence unique requis');
      if(snap.people.some(function(x){return ExpenseRules.key(x.reference)===ExpenseRules.key(p.reference);}))throw Error('Référence déjà enregistrée');
      value={id:Utilities.getUuid(),name:String(p.name).trim().slice(0,150),reference:String(p.reference).trim().slice(0,150)};type='person';
    } else if(p.action==='saveExpenseMapping') {
      value={id:Utilities.getUuid(),supplier:p.supplier,account:String(p.account||'').trim(),kind:p.kind,source:String(p.source||'').trim(),from:ExpenseRules.date(p.from),to:p.to?ExpenseRules.date(p.to):'',plate:ExpenseRules.plate(p.plate),personId:String(p.personId||'')};
      if(!['intermarche','easypark'].includes(value.supplier)||!value.account||!['card','user'].includes(value.kind)||!value.source||(!value.plate&&!value.personId)||(value.to&&value.to<value.from))throw Error('Correspondance incomplète ou dates invalides');
      depCheckLinks_({id:'',lines:[value]},snap,ss);
      if(snap.mappings.some(function(m){return m.supplier===value.supplier&&ExpenseRules.key(m.account)===ExpenseRules.key(value.account)&&m.kind===value.kind&&ExpenseRules.key(m.source)===ExpenseRules.key(value.source)&&m.from<=(value.to||'9999-12-31')&&value.from<=(m.to||'9999-12-31');}))throw Error('Une correspondance couvre déjà ces dates');
      type='mapping';
    } else if(p.action==='setExpenseCompletion') {
      if(!['intermarche','easypark'].includes(p.supplier)||!String(p.account||'').trim()||!['À recevoir','À vérifier','Validé'].includes(p.status))throw Error('Statut invalide');
      var month=ExpenseRules.month(p.month),account=String(p.account).trim();
      if(p.status==='Validé'&&!String(p.reason||'').trim())throw Error('Préciser la vérification, notamment si la dépense est nulle');
      value={key:p.supplier+'|'+ExpenseRules.key(account)+'|'+month,supplier:p.supplier,account:account,month:month,status:p.status,note:String(p.reason||'').slice(0,1000)};type='completion';
    } else throw Error('Action dépenses inconnue');
    var event={type:type,requestId:p.requestId,at:nowIso_(),actor:'Session authentifiée du parc',reason:String(p.reason||'').slice(0,1000),value:value};
    depAppend_(ss,event);return jsonResponse_({ok:true,id:value.id,revision:value.revision});
  } finally {lock.releaseLock();}
}
