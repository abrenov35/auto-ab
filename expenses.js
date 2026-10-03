/* Loaded only when Dépenses is opened. No expenses persisted in browser storage. */
window.Expenses=(function(){
'use strict';
const R=ExpenseRules,P=ExpenseReport,E=escapeHtml;
let data=null,error='',busy=false,reading=false,draft=null,selected='',filter={month:todayParis().slice(0,7),annual:false,plate:'',personId:'',category:'',unassigned:false},pending=null;
let importModules,ocrController,loadingExpenses=false,expenseLoad=null,loadEpoch=0;
const euro=n=>(n/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const supplier=s=>s==='manual'?'Saisie manuelle':s==='intermarche'?'Intermarché':'EasyPark';
const btn=(label,act,extra='')=>'<button type="button" class="button secondary" data-exp="'+act+'" '+extra+'>'+E(label)+'</button>';
const input=(label,name,value='',type='text',required=false)=>'<label class="field">'+E(label)+'<input name="'+E(name)+'" type="'+type+'" value="'+E(value)+'" '+(required?'required':'')+'></label>';
const opts=(items,value)=>items.map(([v,label])=>'<option value="'+E(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+E(label)+'</option>').join('');
const select=(label,name,items,value)=>'<label class="field">'+E(label)+'<select name="'+name+'">'+opts(items,value)+'</select></label>';
const persons=()=>[['','Non affecté'],...data.people.map(p=>[p.id,p.name+' · '+p.reference])];
// Offer the existing fleet drivers without inferring historical expense assignments.
const filterPersons=()=>{
 const people=data.people.map(p=>[p.id,p.name]);
 const known=new Set(data.people.map(p=>R.key(p.name)));
 for(const v of list('vehicules')){
  const name=String(v.conducteur||'').trim(),key=R.key(name);
  if(!name||known.has(key))continue;
  known.add(key);people.push(['fleet-driver:'+key,name]);
 }
 return people.sort((a,b)=>a[1].localeCompare(b[1],'fr',{sensitivity:'base'}));
};
const vehicles=()=>[['','Non affecté'],...list('vehicules').map(v=>[R.plate(v.immatriculation),v.immatriculation+' · '+v.marque+' '+v.modele+(archived(v)?' (archivé)':'')])];
const assignmentLabel=l=>{const p=data.people.find(p=>p.id===l.personId);return l.scope==='common'?'Frais communs':R.assignmentKind(l)==='driver'?(p?p.name+' ('+p.reference+')':'Conducteur à affecter'):R.assignmentKind(l)==='vehicle'?(l.plate||'Véhicule à affecter'):[l.plate,p?.name].filter(Boolean).join(' · ')||'À affecter';};
const number=n=>n===null||n===undefined?'':(n/100).toFixed(2);
function blankLine(){return {category:'fuel',date:'',month:filter.month,label:'',plate:'',personId:'',scope:'unassigned',externalId:'',card:'',litres:null,fuelType:'',maintenanceId:'',amounts:{ht:null,vat:null,ttc:null}};}
function monthOptions(){
 const year=Number(todayParis().slice(0,4)),selectedYear=Number(filter.month.slice(0,4));
 const years=[year-5,year+5,selectedYear,...data.invoices.flatMap(i=>i.lines.map(l=>Number(l.month.slice(0,4)))).filter(Number.isFinite)];
 const first=Math.min(...years),last=Math.max(...years),choices=[];
 for(let y=first;y<=last;y++)for(let m=1;m<=12;m++){
  const value=y+'-'+String(m).padStart(2,'0');
  choices.push([value,new Date(Date.UTC(y,m-1,1)).toLocaleDateString('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'})]);
 }
 return choices;
}

function monthSelector(){
 const choices=monthOptions(),label=choices.find(([value])=>value===filter.month)?.[1]||filter.month;
 return '<div class="field"><span id="expenseMonthLabel">Mois</span><input type="hidden" name="month" value="'+E(filter.month)+'"><details class="expense-month-picker"><summary aria-labelledby="expenseMonthLabel expenseMonthValue"><span id="expenseMonthValue">'+E(label)+'</span><span aria-hidden="true">⌄</span></summary><div class="expense-month-menu"><button type="button" data-exp="scrollMonths" data-direction="-1" aria-label="Voir les mois antérieurs">▲</button><div class="expense-month-list" aria-label="Choisir un mois">'+choices.map(([value,text])=>'<button type="button" data-exp="chooseMonth" data-month="'+E(value)+'"'+(value===filter.month?' aria-current="date"':'')+'>'+E(text)+'</button>').join('')+'</div><button type="button" data-exp="scrollMonths" data-direction="1" aria-label="Voir les mois suivants">▼</button></div></details></div>';
}
function render(){
 if(error)return title('Dépenses',error)+btn('Réessayer','reload');
 if(!data)return '<div class="loading"><span class="spinner"></span> Chargement des dépenses…</div>';
 if(draft)return renderDraft();if(selected)return renderInvoice();
 const lines=P.select(data,filter),sum=R.summary(lines,'ht'),coverage=P.status(data,filter,todayParis());
 const linked=new Set(data.invoices.filter(i=>i.status!=='cancelled').flatMap(i=>i.lines.map(l=>l.maintenanceId).filter(Boolean)));
 const old=list('maintenance').filter(m=>!linked.has(String(m.id))&&m.montant!==''&&m.montant!==null&&m.montant!==undefined&&(filter.annual?(iso(m.date).startsWith(filter.month.slice(0,4))&&iso(m.date).slice(0,7)<=filter.month):iso(m.date).startsWith(filter.month))&&(!filter.plate||R.plate(m.immatriculation)===filter.plate)&&!filter.personId);
 const card=(label,category)=>{const f={...filter,category:category||filter.category},c=P.status(data,f,todayParis()),s=c.sum;const amount=!c.lines.length?euro(0):s.missing&&!c.lines.some(l=>l.amounts.ht!==null)?'HT à vérifier':euro(s.total);return '<button class="metric" type="button" data-exp="category" data-category="'+category+'"><b>'+amount+'</b><span>'+label+' · HT'+'</span></button>';};
 const months=P.months(filter);
 let completeness='';
 for(const s of ['intermarche','easypark']){
  const accounts=[...new Set([...data.invoices.filter(i=>i.supplier===s).map(i=>i.account),...Object.values(data.completion).filter(c=>c.supplier===s).map(c=>c.account)])];
  if(!accounts.length)completeness+='<p>'+supplier(s)+' : <strong>À recevoir</strong> · compte à renseigner</p>';
  for(const a of accounts)for(const m of months){const c=data.completion[s+'|'+R.key(a)+'|'+m],has=data.invoices.some(i=>i.supplier===s&&R.key(i.account)===R.key(a)&&i.status!=='cancelled'&&(i.period===m||i.lines.some(l=>l.month===m)));completeness+='<p>'+E(supplier(s)+' · '+a+' · '+m)+' : <strong>'+E(c?.status||(has?'À vérifier':'À recevoir'))+'</strong></p>';}
 }
 return '<div class="page-title expense-heading"><h1>Dépenses suivies HT</h1><div class="row-actions"><span id="expenseDownload" role="status">'+(loadingExpenses?'Actualisation…':'')+'</span>'+btn('Carburant','manualFuel')+btn('Stationnement','manualParking')+btn('Entretiens','manualMaintenance')+btn('Actualiser / Tout afficher','resetFilters')+'</div></div>'+
 '<form id="expenseFilters" class="expense-filters">'+monthSelector()+select('Période','annual',[['','Mois'],['yes','Cumul janvier → mois choisi']],filter.annual?'yes':'')+select('Véhicule · entretien','plate',[['','Tout le parc'],...vehicles().slice(1)],filter.plate)+select('Conducteur · carburant / stationnement','personId',[['','Tous les conducteurs'],...filterPersons()],filter.personId)+'</form>'+
 '<div class="metrics">'+card('Carburant','fuel')+card('Stationnement','parking')+card('Entretiens / réparations','maintenance')+card('Total des dépenses','')+'</div>'+
 (sum.missing?'<p>'+sum.missing+' montant(s) HT manquant(s), total partiel.</p>':'')+
 '<nav class="toolbar" aria-label="Catégories de dépenses"><div class="row-actions">'+[['fuel','Carburant'],['parking','Stationnement'],['maintenance','Entretiens']].map(([value,label])=>'<button type="button" class="button '+(filter.category===value?'primary':'secondary')+'" data-exp="category" data-category="'+value+'" aria-pressed="'+(filter.category===value)+'">'+label+'</button>').join('')+'</div></nav>'+renderReporting()+
 '<section class="panel"><h2>Opérations · '+lines.length+'</h2>'+renderLines(lines)+'</section>'+

 (old.length?'<section class="panel"><h2>Entretiens existants · montant HT à vérifier</h2><p>Ces '+old.length+' montants ne sont pas additionnés au total '+'HT'+'. Lors de l’import, liez la ligne à l’entretien existant pour éviter une double saisie.</p>'+old.map(m=>'<p>'+E(dateView(m.date)+' · '+m.immatriculation+' · '+m.type)+' : '+E(String(m.montant))+' € · base à vérifier '+(safeLink(m.lienFacture)?'<a href="'+E(safeLink(m.lienFacture))+'" target="_blank" rel="noopener">Facture</a>':'')+'</p>').join('')+'</section>':'')+
 '';
}
function renderReporting(){
 const items=filter.annual?[['Même cumul année précédente',-12]]:[['Mois précédent',-1],['Même mois année précédente',-12]];
 const comparisons=items.map(([label,offset])=>{const c=P.compare(data,filter,offset,todayParis());return '<p><strong>'+label+'</strong> : '+(c.eligible?E((c.delta>0?'+':'')+euro(c.delta)+' HT'+(c.percent===null?' · pourcentage non pertinent': ' ('+(c.percent>0?'+':'')+c.percent.toFixed(1)+' %)')):'Comparaison indisponible · '+E([...new Set([...c.current.reasons,...c.previous.reasons])].join(', ')))+'</p>';}).join('');
 const rows=P.trend(data,filter,todayParis()),maximum=Math.max(1,...rows.map(x=>Math.abs(x.sum.total)));
 return '<details class="panel"><summary>Évolution sur 12 mois et comparatifs HT</summary>'+comparisons+'<p class="hint">Cumul du 1er janvier au mois choisi. Les périodes incomplètes ne sont jamais présentées comme une baisse. Les totaux restent ceux des dépenses suivies.</p><div class="expense-trend">'+rows.map(x=>'<div class="expense-trend-row"><span>'+E(x.month)+'</span><meter min="0" max="'+maximum+'" value="'+Math.abs(x.sum.total)+'" aria-label="Amplitude du montant HT '+E(x.month)+'"></meter><strong>'+(E(euro(x.sum.total))+' HT')+'</strong><small>'+E(x.complete?'Validé':x.reasons.join(' · '))+'</small></div>').join('')+'</div></details>';
}
function exportView(kind){
 const c=P.status(data,filter,todayParis()),label=(filter.annual?'Janvier → ':'')+filter.month,person=data.people.find(p=>p.id===filter.personId);
 const meta=['Dépenses suivies HT · '+label,'Véhicule : '+(filter.plate||'Tout le parc')+' · Personne : '+(person?person.name+' / '+person.reference:'Tout le monde'),'Catégorie : '+(R.categories[filter.category]||'Toutes')+' · Affectation : '+(filter.unassigned?'À affecter':'Toutes'),'État : '+(c.complete?'Imports validés':c.reasons.join(' · ')),'Total HT connu : '+euro(c.sum.total)+' · HT manquants : '+c.sum.missing,'Les montants absents ne sont pas assimilés à zéro.'];
 const header=['Date opération','Mois suivi','Fournisseur','Facture','Catégorie','Libellé','Véhicule','Personne','Référence personne','Affectation','Montant HT EUR','Litres achetés','Justificatif'];
 const rows=c.lines.map(l=>{const p=data.people.find(p=>p.id===l.personId),i=data.invoices.find(i=>i.id===l.invoiceId);return [l.date||'Période déclarée',l.month,supplier(l.supplier),l.number,R.categories[l.category],l.label,R.assignmentKind(l)==='driver'?'':l.plate,R.assignmentKind(l)==='vehicle'?'':p?.name||'',R.assignmentKind(l)==='vehicle'?'':p?.reference||'',l.scope==='common'?'Frais communs':R.needsAssignment(l)?'À affecter':'Affecté',l.amounts.ht===null?'HT manquant':(l.amounts.ht/100).toFixed(2).replace('.',','),l.litres??'',i?.documents.map(d=>safeLink(d.url)).filter(Boolean).join(' ')];});
 const content=kind==='csv'?P.csv([...meta.map(s=>[s]),[],header,...rows]):P.pdf([...meta,'',...c.lines.flatMap(l=>{const p=data.people.find(p=>p.id===l.personId);return [(l.date||l.month+' (période déclarée)')+' | '+supplier(l.supplier)+' '+(l.number||'Sans numéro')+' | '+R.categories[l.category]+' | '+(l.amounts.ht===null?'HT manquant':euro(l.amounts.ht)+' HT'),(assignmentLabel(l))+' | '+l.label+(l.litres===null?'':' | '+l.litres+' litres'),''];})]);
 const url=URL.createObjectURL(new Blob([content],{type:kind==='csv'?'text/csv;charset=utf-8':'application/pdf'})),a=document.createElement('a');a.href=url;a.download='ab-auto-depenses-ht-'+filter.month+'.'+kind;a.textContent='Télécharger le fichier '+kind.toUpperCase();a.className='button secondary';let box=document.getElementById('expenseDownload');if(!box){box=document.createElement('p');box.id='expenseDownload';box.setAttribute('role','status');document.getElementById('expenseFilters').after(box);}box.replaceChildren(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);if(a.isConnected)a.remove();},300000);
}
function renderLines(lines){return lines.length?'<div class="expense-lines">'+lines.map(l=>{const p=data.people.find(p=>p.id===l.personId);return '<article class="expense-row"><div><strong>'+E(l.date?dateView(l.date):l.month+' · période déclarée')+'</strong><small>'+E(l.category==='maintenance'?R.categories[l.category]+(l.plate?' · '+l.plate:''):R.categories[l.category]+' · '+l.label)+'</small></div><div>'+E(l.category==='maintenance'?(l.label||'Entretien'):assignmentLabel(l))+'</div><div class="row-actions">'+btn(l.amounts.ht===null?'HT à vérifier':euro(l.amounts.ht)+' HT','invoice','data-id="'+E(l.invoiceId)+'"')+(data.invoices.some(i=>i.id===l.invoiceId&&i.status!=='cancelled')?'<button type="button" class="button quiet" data-exp="editEntry" data-id="'+E(l.invoiceId)+'" aria-label="Modifier cette entrée" title="Modifier" style="padding:6px;min-width:36px"><span aria-hidden="true">✏️</span></button>':'')+'</div></article>';}).join('')+'</div>':'<p class="empty">Aucune opération enregistrée pour ce filtre. Vérifiez la complétude des imports.</p>';}
function renderInvoice(){const i=data.invoices.find(x=>x.id===selected);if(!i){selected='';return render();}if(i.supplier==='manual')return title(R.categories[i.lines[0].category],'Saisie mensuelle · '+i.period,btn('Retour','back'))+'<section class="panel">'+renderLines(i.lines.map(l=>({...l,invoiceId:i.id})))+(i.status==='cancelled'?'<p>Saisie annulée</p>':'<div class="section-actions">'+btn('Modifier','edit')+btn('Annuler cette saisie','void')+'</div>')+'</section>';return title(supplier(i.supplier)+' · '+(i.number||'Sans numéro'),'Facture du '+dateView(i.date)+' · '+i.account+' · version '+i.revision,btn('Retour','back'))+'<section class="panel">'+i.documents.map(d=>'<p><a href="'+E(safeLink(d.url))+'" target="_blank" rel="noopener">'+E(d.name)+'</a></p>').join('')+'<p>'+E(i.note)+'</p><p>'+E(i.status==='cancelled'?'Import annulé, conservé dans l’historique':'Import enregistré')+'</p>'+renderLines(i.lines.map(l=>({...l,invoiceId:i.id})))+'<details><summary>Historique des modifications</summary>'+data.audit.filter(a=>a.id===i.id).map(a=>'<p>'+E(a.at+' · version '+a.revision+' · '+(a.reason||'Création')+' · '+a.actor)+'</p>').join('')+'</details>'+(i.status!=='cancelled'?'<div class="section-actions">'+btn('Corriger','edit')+btn('Annuler cet import','void')+'</div>':'')+'</section>';}
function renderDraft(){
 const d=draft,review=d.step==='review';
 if(d.kind==='references')return title('Personnes et correspondances','Aucune déduction à partir du conducteur actuel.',btn('Retour','back'))+
 '<section class="panel"><h2>Ajouter une personne</h2><form id="expensePerson" class="expense-grid">'+input('Nom complet','name','', 'text',true)+input('Référence unique (matricule ou e-mail professionnel)','reference','','text',true)+'<button class="button primary">Enregistrer</button></form></section>'+
 '<section class="panel"><h2>Mémoriser une correspondance</h2><form id="expenseMapping" class="expense-grid">'+select('Fournisseur','supplier',[['intermarche','Intermarché'],['easypark','EasyPark']],'intermarche')+input('Compte client','account','','text',true)+select('Identifiant','kind',[['card','Carte carburant'],['user','Utilisateur EasyPark']],'card')+input('Valeur de l’identifiant','source','','text',true)+input('Valable depuis','from','','date',true)+input('Valable jusqu’au (facultatif)','to','','date')+select('Conducteur','personId',persons(),'')+'<button class="button primary">Enregistrer</button></form><p class="hint">Dates incluses. Une correspondance ne réécrit jamais les opérations déjà enregistrées.</p>'+data.mappings.map(m=>'<p>'+E(supplier(m.supplier)+' · '+m.account+' · '+m.source+' : '+(m.plate||m.personId)+' du '+m.from+' au '+(m.to||'sans fin'))+'</p>').join('')+'</section>';
 if(d.kind==='completion')return title('Complétude des imports','Validez uniquement après contrôle de toutes les factures attendues.',btn('Retour','back'))+'<section class="panel"><form id="expenseCompletion" class="expense-grid">'+select('Fournisseur','supplier',[['intermarche','Intermarché'],['easypark','EasyPark']],'intermarche')+input('Compte client','account','','text',true)+input('Mois','month',filter.month,'month',true)+select('État','status',[['À recevoir','À recevoir'],['À vérifier','À vérifier'],['Validé','Validé']],'À vérifier')+input('Contrôle effectué / absence de dépense confirmée','reason','','text',true)+'<button class="button primary">Enregistrer le statut</button></form></section>';
 return title(d.invoice.id?'Corriger l’import':'Importer une facture',review?'3 · Vérifier puis valider':'1 · Déposer les justificatifs → 2 · Renseigner les opérations',btn('Retour','back'))+
 '<div class="notice"><strong>'+E(d.extraction?'Lecture effectuée · vérification obligatoire':'Lecture assistée du justificatif')+'</strong><p>Les scans sont lus sur cet appareil. Le suivi reste en HT ; aucune affectation ne dépend du conducteur actuel.</p>'+(d.extraction?'<ul>'+d.extraction.warnings.map(w=>'<li>'+E(w)+'</li>').join('')+'</ul>':'')+'</div>'+ 
 (review?'<section class="panel"><h2>Contrôle des montants réussi</h2><p>Les lignes expliquent les totaux renseignés. Ce contrôle arithmétique ne garantit pas la fidélité de la saisie au justificatif.</p>'+renderLines(d.invoice.lines.map(l=>({...l,invoiceId:''})))+'<p>'+d.invoice.lines.filter(l=>!l.date).length+' opération(s) utilisent une période déclarée ; '+d.invoice.lines.filter(l=>R.needsAssignment(l)).length+' opération(s) restent à affecter.</p>'+d.files.map(f=>'<p><a target="_blank" rel="noopener" href="'+E(f.url||f.previewUrl||'')+'">'+E(f.name)+'</a></p>').join('')+'<form id="expenseCommit"><label><input type="checkbox" required> J’ai vérifié les montants et les affectations avec les justificatifs.</label><div class="section-actions">'+btn('Modifier','revise')+'<button class="button primary" '+(busy?'disabled':'')+'>Valider l’enregistrement</button></div></form><p id="expenseProgress" role="status"></p></section>':
 '<form id="expenseDraft"><section class="panel expense-grid">'+select('Fournisseur','supplier',[['intermarche','Intermarché'],['easypark','EasyPark']],d.invoice.supplier)+input('Compte client','account',d.invoice.account,'text',true)+input('Numéro de facture (si présent)','number',d.invoice.number)+input('Date de facture','date',d.invoice.date,'date',true)+input('Période déclarée','period',d.invoice.period,'month',true)+input('Total HT (€)','ht',number(d.invoice.totals.ht))+'<details class="expense-extra"><summary>Données du justificatif pour contrôle (facultatif)</summary><div class="expense-grid">'+input('TVA (€)','vat',number(d.invoice.totals.vat))+input('Total TTC (€)','ttc',number(d.invoice.totals.ttc))+'</div></details>'+input('Note / limites du détail','note',d.invoice.note)+(d.invoice.id?input('Motif de correction','reason',d.reason,'text',true):'<label class="field">Facture · PDF, JPG ou PNG, 5 Mo<input type="file" name="invoiceFile" accept="application/pdf,image/jpeg,image/png"></label><label class="field">Relevé détaillé facultatif · 5 Mo<input type="file" name="detailFile" accept="application/pdf,image/jpeg,image/png"></label><p>'+d.files.map(f=>E(f.name)).join(' · ')+'</p>')+(!d.invoice.id?btn('Lire les justificatifs','readInvoice')+'<p id="expenseOcrProgress" role="status"></p>':'')+'</section><div id="expenseLineEditor">'+d.invoice.lines.map(renderLineEditor).join('')+'</div><div class="section-actions">'+btn('Ajouter une opération','addLine')+btn('Appliquer les correspondances datées','applyMappings')+'<button class="button primary">Vérifier les montants</button></div><p class="hint">Sans détail exploitable : saisir une seule ligne « Non affecté » correspondant au total documenté. Les frais communs sont identifiés séparément.</p></form>');
}
function renderLineEditor(l,index){return '<fieldset class="panel expense-grid" data-line="'+index+'"><legend>Opération '+(index+1)+'</legend>'+(l.sourcePerson||l.sourcePlate||l.transactionId?'<p class="expense-source">Lu sur la facture : '+E([l.sourcePerson,l.sourcePlate,l.transactionId].filter(Boolean).join(' · '))+'</p>':'')+select('Catégorie','category',Object.entries(R.categories),l.category)+input('Date d’opération (si présente)','date',l.date,'date')+input('Mois si date absente','month',l.month,'month',true)+input('Libellé','label',l.label)+input(l.amountOrigin==='calculated_from_printed_rate'?'HT calculé au taux imprimé · à vérifier (€)':'HT (€)','ht',number(l.amounts.ht))+'<details class="expense-extra"><summary>Données du justificatif pour contrôle (facultatif)</summary><div class="expense-grid">'+input('TVA (€)','vat',number(l.amounts.vat))+input('TTC (€)','ttc',number(l.amounts.ttc))+'</div></details>'+(R.assignmentKind(l)==='driver'?'<input type="hidden" name="plate" value="'+E(l.plate)+'">':select('Véhicule','plate',vehicles(),l.plate))+(R.assignmentKind(l)==='vehicle'?'<input type="hidden" name="personId" value="'+E(l.personId)+'">':select('Conducteur','personId',persons(),l.personId))+(l.sourcePerson&&l.externalId&&!l.personId?btn('Ajouter la personne lue','createReadPerson','data-index="'+index+'"'):'')+select('Affectation des frais','scope',[['unassigned','Affectation individuelle'],['common','Frais communs']],l.scope==='common'?'common':'unassigned')+'<details class="expense-extra"><summary>Carte, litres, identifiant et entretien lié</summary><div class="expense-grid">'+input('Carte carburant','card',l.card)+input('Identifiant utilisateur fournisseur','externalId',l.externalId)+input('Litres achetés (carburant seulement)','litres',l.litres??'')+input('Type de carburant','fuelType',l.fuelType)+select('Entretien existant à lier (facultatif)','maintenanceId',[['','Aucun'],...list('maintenance').map(m=>[String(m.id),m.date+' · '+m.immatriculation+' · '+m.type])],l.maintenanceId)+'</div></details>'+btn('Retirer cette opération','removeLine','data-index="'+index+'"')+'</fieldset>';}
function collect(){const form=$('#expenseDraft');if(!form)return;const fd=new FormData(form),d=draft;for(const k of ['supplier','account','number','date','period','note'])d.invoice[k]=String(fd.get(k)||'').trim();d.reason=String(fd.get('reason')||'');for(const k of ['ht','vat','ttc'])d.invoice.totals[k]=R.cents(fd.get(k));
 d.invoice.lines=$$('[data-line]',form).map(el=>{const value=n=>el.querySelector('[name="'+n+'"]').value;const l={...blankLine(),...d.invoice.lines[Number(el.dataset.line)],amounts:{ht:null,vat:null,ttc:null}};for(const k of ['category','date','month','label','plate','personId','scope','card','externalId','fuelType','maintenanceId'])l[k]=value(k);l.litres=value('litres').replace(',','.');for(const k of ['ht','vat','ttc'])l.amounts[k]=R.cents(value(k));if(l.amounts.ht!==d.invoice.lines[Number(el.dataset.line)]?.amounts.ht)l.amountOrigin='manual';return l;});
 if(!d.invoice.id){const a=fd.get('invoiceFile'),b=fd.get('detailFile');if(a?.size)d.files=[a,...(b?.size?[b]:[])];else if(b?.size&&d.files.length)d.files=[d.files[0],b];d.files.forEach(f=>{if(!f.previewUrl)f.previewUrl=URL.createObjectURL(f);});}
}
async function readInvoice(){
 collect();if(!draft.files.length)throw Error('Joindre une facture avant la lecture.');
 if(draft.invoice.lines.some(l=>l.amounts.ht!==null||l.amounts.ttc!==null)&&!confirm('Remplacer la saisie actuelle par la lecture des justificatifs ?'))return;
 const targetDraft=draft,sessionToken=state.token;reading=true;ocrController=new AbortController();const controller=ocrController;const progress=$('#expenseOcrProgress');
 const show=message=>{if(progress){progress.textContent=message;progress.append(document.createTextNode(' '));const cancel=document.createElement('button');cancel.type='button';cancel.dataset.exp='cancelOcr';cancel.className='button secondary';cancel.textContent='Annuler la lecture';progress.append(cancel);}};
 try{
  show('Préparation de la lecture…');
  if(!importModules)importModules=(async()=>{for(const src of ['expenses-import.js?v=1','expenses-reader.js?v=1'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Module de lecture indisponible'));};document.head.append(s);});})();
  await importModules;const pages=await window.ExpenseReader.read(draft.files,show,ocrController.signal);if(draft!==targetDraft||state.token!==sessionToken)return;const parsed=ExpenseImport.parse(draft.invoice.supplier,pages);
  parsed.invoice.lines=parsed.invoice.lines.map(l=>{const known=list('vehicules').find(v=>R.plate(v.immatriculation)===l.sourcePlate);if(known)l.plate=R.plate(known.immatriculation);const person=data.people.find(p=>p.reference===l.externalId&&l.externalId);if(person)l.personId=person.id;return R.mapped(l,parsed.invoice,data.mappings);});
  if(!parsed.invoice.lines.length)throw Error('Aucune opération reconnue. La saisie actuelle est conservée ; complétez-la depuis le justificatif.');
  draft.invoice=parsed.invoice;draft.extraction=parsed;draft.step='edit';
  toast('Lecture terminée : vérifiez les montants et les affectations avant validation.');
 }catch(e){if(!window.ExpenseReader)importModules=null;toast(controller.signal.aborted?'Lecture annulée. Aucune facture enregistrée.':e.message,true);}finally{reading=false;ocrController=null;renderApp();}
}
async function loadExpenses({fresh=false}={}){
 if(expenseLoad)return expenseLoad;
 const token=state.token,epoch=loadEpoch;error='';loadingExpenses=true;renderApp();
 const promise=(async()=>{
  try{const result=await request('readExpenses',{fresh});if(state.token===token&&loadEpoch===epoch)data=result;}
  catch(e){if(state.token!==token||loadEpoch!==epoch)return;const message=e.message.includes('Action')?'Le serveur Dépenses doit être déployé avant utilisation.':e.message;if(data)toast('Actualisation impossible. Les dernières données affichées sont conservées. '+message,true);else error=message;}
  finally{if(loadEpoch===epoch){loadingExpenses=false;expenseLoad=null;renderApp();}}
 })();
 expenseLoad=promise;return promise;
}
function renderApp(){if(state.view==='expenses'&&state.token!=="")window.render();}
async function mutate(action,payload){if(busy)return false;busy=true;const signature=JSON.stringify({action,payload});if(!pending||pending.signature!==signature)pending={signature,id:crypto.randomUUID()};try{await request(action,{...payload,requestId:pending.id});data=await request('readExpenses');pending=null;return true;}catch(e){toast(e.message+' Si la réponse est incertaine, réessayez sans modifier la saisie.',true);return false;}finally{busy=false;}}

function openManual(category,invoice){
 if(!data.manualEntry){toast('La mise à jour du serveur de saisie doit être publiée.',true);return;}
 let dialog=document.getElementById('expenseManualDialog');
 if(dialog)dialog.remove();
 dialog=document.createElement('dialog');dialog.id='expenseManualDialog';dialog.setAttribute('aria-labelledby','expenseManualTitle');
 const l=invoice?.lines[0],vehicle=category==='maintenance',label={fuel:'Carburant',parking:'Stationnement',maintenance:'Entretiens'}[category];
 const choices=vehicle?vehicles():[['','Choisir un chauffeur'],...filterPersons()];
 dialog.innerHTML='<form id="expenseManual"><div class="dialog-header"><h2 id="expenseManualTitle">'+label+'</h2></div><div class="form-grid"><label class="field wide">'+(vehicle?'Véhicule':'Chauffeur')+'<select name="'+(vehicle?'plate':'personId')+'" required>'+opts(choices,vehicle?(l?.plate||''):(l?.personId||''))+'</select></label>'+(vehicle?input('Date (JJ/MM/AAAA)','date',l?(l.date?l.date.split('-').reverse().join('/'):''):todayParis().split('-').reverse().join('/'),'text',true):input('Mois','month',l?.month||filter.month,'month',true))+input('Montant HT (€)','amount',l?number(l.amounts.ht):'','text',true)+(vehicle?'<label class="field wide">Désignation / description<textarea name="description" maxlength="1000">'+E(l?.label||'')+'</textarea></label>':'')+'</div><p id="expenseManualStatus" class="hint" role="status" style="padding:0 16px;margin:0"></p><div class="dialog-actions"><button type="button" class="button secondary" data-exp="closeManual">Annuler</button><button type="submit" class="button primary">Enregistrer</button></div></form>';
 dialog.querySelector('[name="amount"]').setAttribute('inputmode','decimal');
 if(vehicle){const dateInput=dialog.querySelector('[name="date"]');dateInput.placeholder='JJ/MM/AAAA';dateInput.maxLength=10;}
 const form=dialog.querySelector('form');form.dataset.category=category;
 if(invoice){form.dataset.invoiceId=invoice.id;form.dataset.revision=invoice.revision;}
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>dialog.remove());
 document.body.append(dialog);dialog.showModal();
}
async function submitManual(form){
 const fd=new FormData(form),amount=R.cents(fd.get('amount'));
 if(amount===null||amount<0)throw Error('Saisir un montant HT positif ou nul.');
 const vehicle=form.dataset.category==='maintenance';
 if(vehicle&&!data.manualMaintenanceDate)throw Error('Date et description : publiez la nouvelle version du serveur Apps Script, puis actualisez les dépenses.');
 let date='';if(vehicle){const value=String(fd.get('date')||'').trim();if(!/^\d{2}\/\d{2}\/\d{4}$/.test(value))throw Error('Saisir la date au format JJ/MM/AAAA.');date=R.date(value.split('/').reverse().join('-'));}
 const manual={category:form.dataset.category,month:vehicle?date.slice(0,7):R.month(fd.get('month')),amount:(amount/100).toFixed(2),plate:String(fd.get('plate')||''),personId:String(fd.get('personId')||''),id:form.dataset.invoiceId||''};
 if(vehicle){manual.date=date;manual.description=String(fd.get('description')||'').trim();}
 const dialog=form.closest('dialog'),status=form.querySelector('#expenseManualStatus');
 form.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Enregistrement…';
 try{
  const saved=await mutate('saveExpenseInvoice',{manual,expectedRevision:Number(form.dataset.revision||0),reason:manual.id?'Correction de saisie mensuelle':'Saisie mensuelle'});
  if(saved){filter.month=manual.month;filter.category='';filter.plate='';filter.personId='';filter.unassigned=false;dialog.close();renderApp();toast('Dépense enregistrée.');}
  else status.textContent='Enregistrement non confirmé. La saisie est conservée ; vous pouvez réessayer.';
 }finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}
}

async function handle(act,el){if(act==='cancelOcr'){ocrController?.abort();return;}if(busy||reading)return;
 if(act==='chooseMonth'){filter.month=el.dataset.month;renderApp();document.querySelector('.expense-month-picker summary')?.focus();return;}
 if(act==='scrollMonths'){el.closest('.expense-month-menu').querySelector('.expense-month-list').scrollBy({top:Number(el.dataset.direction)*224,behavior:'smooth'});return;}
 if(act==='previousMonth'||act==='nextMonth'){
 const [year,month]=filter.month.split('-').map(Number);
 const next=new Date(Date.UTC(year,month-1+(act==='nextMonth'?1:-1),1));
 filter.month=next.toISOString().slice(0,7);renderApp();return;
 }
 if(act==='editEntry'){
 const invoice=data.invoices.find(i=>i.id===el.dataset.id);
 if(!invoice||invoice.status==='cancelled')return;
 if(invoice.supplier==='manual'){openManual(invoice.lines[0].category,invoice);return;}
 selected=invoice.id;return handle('edit',el);
 }
 if(act==='closeManual'){document.getElementById('expenseManualDialog')?.close();return;}
 if(['manualFuel','manualParking','manualMaintenance'].includes(act)){openManual({manualFuel:'fuel',manualParking:'parking',manualMaintenance:'maintenance'}[act]);return;}
 if(act==='edit'&&data.invoices.find(i=>i.id===selected)?.supplier==='manual'){const i=data.invoices.find(i=>i.id===selected);openManual(i.lines[0].category,i);return;}
 if(act==='readInvoice')return readInvoice();
 if(act==='csv'||act==='pdf'){exportView(act);return;}
 if(act==='createReadPerson'){collect();const l=draft.invoice.lines[Number(el.dataset.index)];if(!l?.sourcePerson||!l.externalId)return;if(!confirm('Ajouter '+l.sourcePerson+' avec la référence '+l.externalId+' ?'))return;const existing=data.people.find(p=>p.reference===l.externalId);if(existing)l.personId=existing.id;else if(await mutate('saveExpensePerson',{name:l.sourcePerson,reference:l.externalId})){const person=data.people.find(p=>p.reference===l.externalId);if(person)draft.invoice.lines.forEach(x=>{if(x.externalId===l.externalId&&!x.personId)x.personId=person.id;});}renderApp();return;}
 if(act==='resetFilters'){filter={month:todayParis().slice(0,7),annual:false,plate:'',personId:'',category:'',unassigned:false};return loadExpenses({fresh:true});}
 if(act==='reload')return loadExpenses();
 if(act==='back'){if(draft?.kind==='invoice'&&!confirm('Quitter cette saisie non enregistrée ?'))return;draft=null;selected='';}
 if(act==='new'){draft={kind:'invoice',step:'edit',invoice:{supplier:'intermarche',account:'',number:'',date:todayParis(),period:filter.month,totals:{ht:null,vat:null,ttc:null},note:'',lines:[blankLine()]},files:[],reason:''};selected='';}
 if(act==='references'||act==='completion')draft={kind:act};
 if(act==='invoice'){if(!el.dataset.id)return;selected=el.dataset.id;}
 if(act==='category')filter.category=el.dataset.category;
 if(act==='unassigned')filter.unassigned=!filter.unassigned;
 if(act==='edit'){const i=data.invoices.find(i=>i.id===selected);draft={kind:'invoice',step:'edit',invoice:JSON.parse(JSON.stringify(i)),files:i.documents,reason:''};selected='';}
 if(act==='void'){const i=data.invoices.find(i=>i.id===selected),reason=prompt('Motif d’annulation (l’historique et les justificatifs seront conservés)');if(!reason||!confirm('Confirmer l’annulation de cet import ?'))return;if(await mutate('cancelExpenseInvoice',{id:i.id,expectedRevision:i.revision,reason}))toast('Import annulé.');}
 if(act==='revise')draft.step='edit';
 if(['addLine','removeLine','applyMappings'].includes(act)){
  collect();if(act==='addLine'){if(draft.invoice.lines.length>=100)throw Error('Maximum 100 opérations');const l=blankLine();l.category=draft.invoice.supplier==='easypark'?'parking':'fuel';l.month=draft.invoice.period;draft.invoice.lines.push(l);}
  if(act==='removeLine')draft.invoice.lines.splice(Number(el.dataset.index),1);
  if(act==='applyMappings'){draft.invoice.lines=draft.invoice.lines.map(l=>R.mapped(l,draft.invoice,data.mappings));toast('Correspondances appliquées aux dates ou périodes entièrement couvertes. Vérifiez les affectations.');}
 }
 renderApp();
}
async function submit(form){
 if(busy||reading)return;
 if(form.id==='expenseManual')return submitManual(form);
 if(form.id==='expenseDraft'){collect();const validated=R.validate(draft.invoice);draft.invoice={...draft.invoice,...validated};if(!draft.invoice.id&&!draft.files.length)throw Error('Joindre la facture');for(const f of draft.files)if(f.size>5*1024*1024||(!draft.invoice.id&&!['application/pdf','image/jpeg','image/png'].includes(f.type)))throw Error('Justificatif PDF/JPG/PNG, 5 Mo maximum');draft.step='review';renderApp();return;}
 if(form.id==='expenseCommit'){
  if(!form.reportValidity())return;
  reading=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);$('#expenseProgress').textContent='Lecture des justificatifs puis confirmation par le serveur…';
  try{const documents=draft.invoice.id?[]:await Promise.all(draft.files.map(async f=>({name:f.name,mime:f.type,base64:await new Promise((res,rej)=>{const reader=new FileReader();reader.onerror=()=>rej(Error('Lecture impossible'));reader.onload=()=>res(String(reader.result).split(',')[1]);reader.readAsDataURL(f);})})));if(await mutate('saveExpenseInvoice',{invoice:draft.invoice,documents,expectedRevision:draft.invoice.revision||0,reason:draft.reason})){draft=null;toast('Import enregistré et confirmé par le serveur.');}}finally{reading=false;renderApp();}return;
 }
 const payload=Object.fromEntries(new FormData(form));const action={expensePerson:'saveExpensePerson',expenseMapping:'saveExpenseMapping',expenseCompletion:'setExpenseCompletion'}[form.id];
 if(action){if(await mutate(action,payload)){toast('Enregistré.');if(form.id==='expenseCompletion')draft=null;}renderApp();}
}
document.addEventListener('toggle',e=>{
 const picker=e.target;if(!picker.matches?.('.expense-month-picker')||!picker.open)return;
 const list=picker.querySelector('.expense-month-list'),active=list.querySelector('[aria-current]');
 if(active)list.scrollTop=active.offsetTop;
},true);
document.addEventListener('click',e=>{
 document.querySelectorAll('.expense-month-picker[open]').forEach(p=>{if(!p.contains(e.target))p.open=false;});
});
document.addEventListener('keydown',e=>{
 const picker=e.target.closest('.expense-month-picker');if(!picker)return;
 if(e.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();return;}
 const list=picker.querySelector('.expense-month-list'),items=[...list.children];
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
 e.preventDefault();picker.open=true;
 const index=items.indexOf(document.activeElement),current=items.findIndex(x=>x.hasAttribute('aria-current'));
 const next=e.key==='Home'?0:e.key==='End'?items.length-1:index<0?current:Math.max(0,Math.min(items.length-1,index+(e.key==='ArrowDown'?1:-1)));
 items[next]?.focus({preventScroll:true});
 if(items[next]){const top=items[next].offsetTop;if(top<list.scrollTop)list.scrollTop=top;else if(top+32>list.scrollTop+list.clientHeight)list.scrollTop=top+32-list.clientHeight;}
 }
});
document.addEventListener('click',e=>{const el=e.target.closest('[data-exp]');if(el){e.preventDefault();handle(el.dataset.exp,el).catch(e=>toast(e.message,true));}});
document.addEventListener('submit',e=>{if(e.target.id.startsWith('expense')){e.preventDefault();if(e.target.reportValidity())submit(e.target).catch(e=>toast(e.message,true));}});
document.addEventListener('change',e=>{if(e.target.closest('#expenseFilters')){filter={...filter,...Object.fromEntries(new FormData($('#expenseFilters')))};filter.annual=filter.annual==='yes';if(e.target.name==='plate'&&filter.plate)filter.personId='';if(e.target.name==='personId'&&filter.personId)filter.plate='';renderApp();}else if(e.target.name==='category'&&e.target.closest('#expenseDraft')){collect();renderApp();}else if(e.target.name==='category'&&!e.target.closest('#expenseDraft')){filter.category=e.target.value;renderApp();}});
return {render,open:loadExpenses,allowLeave(){if(busy||reading){toast('Enregistrement en cours. Attendez la réponse du serveur.',true);return false;}if(draft?.kind==='invoice'){if(!confirm('Quitter la saisie non enregistrée ?'))return false;draft=null;}return true;},reset(){loadEpoch++;expenseLoad=null;loadingExpenses=false;ocrController?.abort();data=null;draft=null;selected='';pending=null;error='';}};
})();

