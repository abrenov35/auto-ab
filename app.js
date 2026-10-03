"use strict";
const API_URL = "https://script.google.com/macros/s/AKfycbwHL8O_Apgjv4gq8VKxxPcGcxeXQUeOSesN7vVlHOrdHRxbI2gf3kyajV64IuEbPuya/exec";
const initialPlate=new URLSearchParams(location.search).get("vehicule");
const SESSION_KEY="autoAbSession",CACHE_KEY="autoAbParcCache";
function storedSession(){
  try{const session=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");if(session?.token&&session.expiresAt>Date.now())return session.token}catch{}
  localStorage.removeItem(SESSION_KEY);localStorage.removeItem(CACHE_KEY);
  const previous=sessionStorage.getItem("autoAbToken");
  if(previous){localStorage.setItem(SESSION_KEY,JSON.stringify({token:previous,expiresAt:Date.now()+30*60000}));return previous}
  return "";
}
const state = {data:null,view:initialPlate?"detail":"dashboard",vehicle:initialPlate,query:"",filter:"active",busy:false,form:null,token:storedSession(),mailSettings:null,syncing:false,stale:false,lastSync:0};
function clearAccess(){window.Expenses?.reset();state.token="";state.data=null;state.syncing=false;state.stale=false;localStorage.removeItem(SESSION_KEY);localStorage.removeItem(CACHE_KEY);sessionStorage.removeItem("autoAbToken")}
function saveParcCache(){try{localStorage.setItem(CACHE_KEY,JSON.stringify({data:state.data,at:state.lastSync}))}catch{}}
function restoreParcCache(){
  if(!state.token)return;
  try{const cache=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
    if(cache?.data&&cache.at>Date.now()-6*3600000){state.data=cache.data;state.lastSync=cache.at;state.syncing=true;state.stale=true}
  }catch{localStorage.removeItem(CACHE_KEY)}
}
const $ = (s,root=document)=>root.querySelector(s);
const escapeHtml = value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = value=>String(value??"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const samePlate = (a,b)=>norm(a)===norm(b);
const list = key=>Array.isArray(state.data?.[key])?state.data[key]:[];
const archived = item=>String(item?.statut||"").toLocaleLowerCase("fr").includes("archiv");
const vehicle = plate=>list("vehicules").find(v=>samePlate(v.immatriculation,plate));
const activeRevision = plate=>list("revisions").find(r=>samePlate(r.immatriculation,plate)&&!archived(r));
const activeCt = plate=>list("controlsTk").find(c=>samePlate(c.immatriculation,plate)&&!archived(c));
const revDate = r=>iso(r?.prochainDate||r?.dateProchaineRevision);
const revLast = r=>iso(r?.dernierDate||r?.dateDerniereRevision);
const ctDate = c=>iso(c?.prochainDate||c?.dateProchainCT);
const ctLast = c=>iso(c?.dernierDate||c?.dateDernierCT);
const dateView = value=>{const d=iso(value);return d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"—"};
function iso(value){
  if(!value)return "";
  const text=String(value).trim();
  const fr=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if(fr)return fr[3]+"-"+fr[2]+"-"+fr[1];
  const en=/^(\d{4}-\d{2}-\d{2})/.exec(text);
  return en?en[1]:"";
}
function days(value){
  const d=iso(value);
  if(!d)return null;
  const target=Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10));
  const parts=Object.fromEntries(new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const today=Date.UTC(+parts.year,+parts.month-1,+parts.day);
  return Math.round((target-today)/86400000);
}
function todayParis(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  return parts.year+"-"+parts.month+"-"+parts.day;
}
function status(date){
  const n=days(date);
  if(n===null)return {label:"Date à renseigner",tone:"muted"};
  if(n<0)return {label:"En retard de "+Math.abs(n)+" j",tone:"danger"};
  if(n<=30)return {label:n===0?"Aujourd’hui":"J-"+n,tone:"warning"};
  return {label:"À jour",tone:"ok"};
}
function km(value){return value===""||value===null||value===undefined?"Non renseigné":Number(value).toLocaleString("fr-FR")+" km"}
function safeLink(value){try{const u=new URL(String(value));return u.protocol==="https:"&&["drive.google.com","docs.google.com"].includes(u.hostname)?u.href:""}catch{return ""}}
function alertItems(){
  const rows=[];
  for(const v of list("vehicules").filter(x=>!archived(x))){
    const r=activeRevision(v.immatriculation),c=activeCt(v.immatriculation);
    for(const [type,date,kind,item] of [["Révision",revDate(r),"revision",r],["Contrôle technique",ctDate(c),"ct",c]]){
      const n=days(date);
      if(n!==null&&n<=30)rows.push({v,type,date,n,kind,id:item?.id,acquit:item?.alerteMailAcquittee});
    }
    for(const m of list("maintenance").filter(x=>samePlate(x.immatriculation,v.immatriculation)&&!archived(x))){
      const date=iso(m.prochaineDate),n=days(date);
      if(n!==null&&n<=30)rows.push({v,type:m.type||"Entretien",date,n,kind:"maintenance",id:m.id,acquit:m.alerteMailAcquittee});
    }
  }
  return rows.sort((a,b)=>a.n-b.n||String(a.v.immatriculation).localeCompare(String(b.v.immatriculation)));
}
function toast(message,error=false){
  const el=$("#toast");el.textContent=message;el.className="toast show"+(error?" error":"");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className="toast",4500);
}
async function request(action,payload={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),action==="loginAndReadParc"?60000:45000);
  try{
    const res=await fetch(API_URL,{method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload,token:state.token}),
      cache:"no-store",signal:controller.signal});
    const text=await res.text();
    let result;try{result=JSON.parse(text)}catch{throw Error("Le service a renvoyé une réponse illisible.")}
    if(!res.ok||result.ok!==true){
      const message=result.error||result.message||"Enregistrement impossible";
      if(message.includes("Accès requis")){clearAccess();renderLogin("Session expirée. Saisis de nouveau le code.")}
      throw Error(message);
    }
    return result;
  }catch(e){
    if(e.name==="AbortError")throw Error("Le service Google tarde à répondre. Réessaie dans quelques instants.");
    if(e instanceof TypeError)throw Error("Connexion au service indisponible. Aucune modification enregistrée.");
    throw e;
  }finally{clearTimeout(timer)}
}
async function load({quiet=false}={}){
  if(!state.token){renderLogin();return}
  if(!quiet&&!state.data)$("#app").innerHTML='<div class="loading"><span class="spinner"></span> Chargement du parc…</div>';
  try{state.data=await request("readParc");state.lastSync=Date.now();state.syncing=false;state.stale=false;saveParcCache();render()}
  catch(e){
    if(e.message.includes("Accès requis")){clearAccess();renderLogin("Session expirée. Saisis de nouveau le code.");return}
    if(state.data){state.syncing=false;state.stale=true;render();toast(e.message,true);return}
    $("#app").innerHTML='<div class="notice error"><strong>Le parc ne peut pas être chargé</strong><p>'+escapeHtml(e.message)+'</p><button class="button primary" type="button" data-action="reload">Réessayer</button></div>';
  }
}
let expensesLoading;
async function openExpenses(){
 state.view="expenses";render();
 try{if(!expensesLoading)expensesLoading=(async()=>{for(const src of ["expenses-core.js?v=2","expenses-report.js?v=2","expenses.js?v=21"]){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error("Chargement des dépenses impossible"))};document.head.append(s);});}})();await expensesLoading;await window.Expenses.open();}
 catch(e){expensesLoading=null;toast(e.message,true);}
}
function render(){
  document.querySelector(".tabs").hidden=false;$("#refreshButton").hidden=false;$("#logoutButton").hidden=false;
  $$(".tab").forEach(el=>el.classList.toggle("active",el.dataset.view===state.view));
  if(state.view==="detail"&&state.vehicle&&!vehicle(state.vehicle)){state.view="vehicles";state.vehicle=null}
  const syncNote=state.stale&&state.lastSync?'<div class="sync-note" role="status">'+(state.syncing?"Actualisation en cours… · ":"Dernière synchronisation : ")+new Date(state.lastSync).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+' · <button type="button" data-action="reload">Actualiser</button></div>':"";
  $("#app").innerHTML=syncNote+(state.view==="expenses"?(window.Expenses?window.Expenses.render():'<div class="loading">Chargement des dépenses…</div>'):state.view==="detail"?renderDetail():state.view==="vehicles"?renderVehicles():state.view==="settings"?renderSettings():renderDashboard());
  if(state.view==="vehicles"){const input=$("#search");if(input){input.value=state.query}}
}
function $$(s,root=document){return [...root.querySelectorAll(s)]}
function title(name,sub,button=""){return '<div class="page-title"><div><h1>'+escapeHtml(name)+'</h1><p>'+escapeHtml(sub)+'</p></div>'+button+'</div>'}
function renderLogin(message=""){
  document.querySelector(".tabs").hidden=true;$("#refreshButton").hidden=true;$("#logoutButton").hidden=true;
  $("#app").innerHTML='<section class="panel access-card"><h1>Accès au parc</h1><p>Saisis le code pour consulter les véhicules.</p><form id="loginForm"><label for="accessPin">Code d’accès</label><input id="accessPin" type="password" inputmode="numeric" autocomplete="off" required maxlength="20"><button class="button primary" type="submit">Ouvrir le parc</button></form>'+(message?'<p class="notice error">'+escapeHtml(message)+'</p>':"")+'</section>';
  $("#accessPin").focus();
}
function addressRow(kind,value=""){
  return '<div class="address-row"><input type="email" required autocomplete="email" value="'+escapeHtml(value)+'" aria-label="Adresse '+(kind==="to"?"destinataire":"en copie")+'"><button type="button" class="button quiet" data-action="removeAddress" aria-label="Retirer cette adresse">Retirer</button></div>';
}
function renderSettings(){
  const settings=state.mailSettings;
  return title("Paramètres","Destinataires des alertes quotidiennes.")+
    '<section class="panel mail-settings"><h2>Alertes par mail</h2><p class="hint">Les messages partent du compte AB RENOV 35. Chaque adresse reçoit le même récapitulatif.</p>'+
    (settings?'<form id="mailSettingsForm"><h3>Destinataires</h3><div id="mailTo">'+settings.to.map(x=>addressRow("to",x)).join("")+'</div><button class="button secondary" type="button" data-action="addAddress" data-kind="to">+ Ajouter une adresse</button><h3>En copie</h3><div id="mailCc">'+settings.cc.map(x=>addressRow("cc",x)).join("")+'</div><button class="button secondary" type="button" data-action="addAddress" data-kind="cc">+ Ajouter une adresse en copie</button><div class="section-actions"><button class="button primary" type="submit">Enregistrer les adresses</button></div></form>':'<p>Chargement des adresses…</p>')+'</section>';
}
async function openSettings(){
  state.view="settings";render();
  try{state.mailSettings=await request("getMailSettings");render()}
  catch(e){toast(e.message,true)}
}
function action(label,act,plate,kind="secondary"){return '<button type="button" class="button '+kind+'" data-action="'+escapeHtml(act)+'" data-plate="'+escapeHtml(plate)+'">'+escapeHtml(label)+'</button>'}
function ackButton(plate,type,date,id,acquit){return '<button type="button" class="button quiet" data-action="ackMail" data-plate="'+escapeHtml(plate)+'" data-type="'+escapeHtml(type)+'" data-date="'+escapeHtml(date)+'" data-id="'+escapeHtml(id||"")+'" data-acquit="'+Boolean(acquit)+'">'+(acquit?"Réactiver les mails":"J’ai pris en charge")+'</button>'}
function renderDashboard(){
  const vehicles=list("vehicules").filter(v=>!archived(v)),alerts=alertItems();
  const late=alerts.filter(x=>x.n<0),soon=alerts.filter(x=>x.n>=0);
  const missing=vehicles.filter(v=>!activeRevision(v.immatriculation)||!activeCt(v.immatriculation));
  return title("À suivre","Les échéances des 30 prochains jours, sans calcul à faire.")+
    '<div class="metrics"><div class="metric"><b>'+vehicles.length+'</b><span>Véhicules suivis</span></div><div class="metric danger"><b>'+late.length+'</b><span>Échéances dépassées</span></div><div class="metric warning"><b>'+soon.length+'</b><span>À traiter sous 30 jours</span></div><div class="metric"><b>'+missing.length+'</b><span>Fiches à compléter</span></div></div>'+
    '<section class="panel"><h2>Échéances prioritaires</h2>'+
    (alerts.length?'<div class="alert-list">'+alerts.map(({v,type,date,n,kind,id,acquit})=>
      '<div class="alert-item"><div><strong>'+escapeHtml(v.marque+" "+v.modele)+'</strong><small>'+escapeHtml(v.immatriculation)+' · '+escapeHtml(v.conducteur||"Sans conducteur")+'</small></div>'+
      '<div>'+escapeHtml(type)+'</div><div>'+dateView(date)+' <span class="badge '+(n<0?"danger":"warning")+'">'+(n<0?"Retard "+Math.abs(n)+" j":"J-"+n)+'</span></div>'+
      '<div class="row-actions">'+(acquit?'<span class="badge ok">Pris en charge</span>':"")+ackButton(v.immatriculation,kind,date,id,acquit)+action("Ouvrir","detail",v.immatriculation,"quiet")+'</div></div>').join("")+'</div>':
      '<div class="empty">Aucune échéance dans les 30 jours.</div>')+'</section>'+
    (missing.length?'<section class="panel"><h2>Fiches à compléter</h2><p class="hint">Une date absente ne peut pas produire d’alerte.</p>'+
      '<div class="alert-list">'+missing.map(v=>'<div class="alert-item"><strong>'+escapeHtml(v.marque+" "+v.modele+" · "+v.immatriculation)+'</strong><span>'+
      (!activeRevision(v.immatriculation)?"Révision à renseigner ":"")+
      (!activeCt(v.immatriculation)?"CT à renseigner":"")+'</span><span></span>'+action("Ouvrir","detail",v.immatriculation,"quiet")+'</div>').join("")+'</div></section>':"");
}
function nextSummary(v){
  return [["Révision",revDate(activeRevision(v.immatriculation))],["CT",ctDate(activeCt(v.immatriculation))]]
    .map(([name,date])=>'<span>'+escapeHtml(name)+' : '+dateView(date)+(date&&days(date)<=30?' <b class="badge '+status(date).tone+'">'+escapeHtml(status(date).label)+'</b>':"")+'</span>').join("");
}
function renderVehicles(){
  const all=list("vehicules");
  const query=state.query.toLocaleLowerCase("fr").trim();
  const matched=all.filter(v=>[v.marque,v.modele,v.immatriculation,v.conducteur].join(" ").toLocaleLowerCase("fr").includes(query));
  const active=matched.filter(v=>!archived(v)).sort((a,b)=>String(a.marque+" "+a.modele).localeCompare(String(b.marque+" "+b.modele),"fr"));
  const old=matched.filter(archived);
  const row=(v,isOld=false)=>{
    const due=Math.min(...[revDate(activeRevision(v.immatriculation)),ctDate(activeCt(v.immatriculation))].map(days).filter(n=>n!==null));
    const tone=isOld?"archived":due<0?"overdue":due<=30?"alert":"";
    return '<div class="vehicle-row '+tone+'"><div><strong>'+escapeHtml(v.marque+" "+v.modele)+'</strong><small>'+escapeHtml(v.immatriculation)+'</small></div>'+
      '<div>'+escapeHtml(v.conducteur||"Sans conducteur")+'<small>'+escapeHtml(v.statut||"Actif")+'</small></div>'+
      '<div>'+escapeHtml(km(v.kilometrage))+'</div><div class="next">'+(isOld?"Archivé":nextSummary(v))+'</div>'+
      '<div class="row-actions">'+(isOld?action("Restaurer","restoreVehicle",v.immatriculation,"quiet"):action("Voir la fiche","detail",v.immatriculation,"secondary"))+'</div></div>';
  };
  return title("Les véhicules",all.length+" véhicules dans le parc.",action("+ Ajouter","newVehicle","","primary"))+
    '<div class="toolbar"><input id="search" type="search" placeholder="Rechercher une plaque, un modèle, un conducteur" aria-label="Rechercher un véhicule"><select id="filter" class="select-filter" aria-label="Afficher"><option value="active"'+(state.filter==="active"?" selected":"")+'>Véhicules actifs</option><option value="archived"'+(state.filter==="archived"?" selected":"")+'>Archives</option></select></div>'+
    (state.filter==="archived"?'<section class="panel"><h2>Véhicules archivés ('+old.length+')</h2><div class="vehicle-list">'+(old.length?old.map(v=>row(v,true)).join(""):'<div class="empty">Aucun véhicule archivé.</div>')+'</div></section>':
    '<div class="vehicle-list">'+(active.length?active.map(v=>row(v)).join(""):'<div class="empty">Aucun véhicule trouvé.</div>')+'</div>');
}
function field(label,value){return '<dl class="kv"><dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(value??"—")+'</dd></dl>'}
function documentRows(plate,category){
  const vehId=vehicle(plate)?.id;
  const docs=list("documents").filter(d=>(samePlate(d.immatriculation,plate)||Boolean(vehId&&String(d.idVehicule)===String(vehId)))&&(!category||String(d.categorie||d.type).toLocaleLowerCase("fr").includes(category)));
  return docs.sort((a,b)=>String(b.dateUpload||b.date||"").localeCompare(String(a.dateUpload||a.date||"")))
    .map(d=>{const url=safeLink(d.lienDrive||d.lien);return '<div class="history-row"><small>'+dateView(d.date||d.dateUpload)+'</small><span class="title">'+escapeHtml(d.nom||d.nomFichier||"Document")+'</span><span>'+escapeHtml(d.categorie||d.type||"")+'</span>'+(url?'<a class="button secondary" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Voir</a>':"")+'</div>'}).join("");
}
function renderDetail(){
  const v=vehicle(state.vehicle),plate=v.immatriculation,r=activeRevision(plate),c=activeCt(plate);
  const ctHist=list("historiqueCt").filter(x=>samePlate(x.immatriculation,plate));
  const archivedCt=list("controlsTk").filter(x=>samePlate(x.immatriculation,plate)&&archived(x));
  const maint=list("maintenance").filter(x=>samePlate(x.immatriculation,plate)).sort((a,b)=>iso(b.date).localeCompare(iso(a.date)));
  const revisions=list("revisions").filter(x=>samePlate(x.immatriculation,plate)&&archived(x));
  const changes=[
    ...list("historiqueKilometrage").filter(x=>samePlate(x.immatriculation,plate)).map(x=>({date:x.date,type:"Kilométrage",text:km(x.ancien)+" → "+km(x.nouveau)})),
    ...list("historiqueAffectations").filter(x=>samePlate(x.immatriculation,plate)).map(x=>({date:x.date,type:"Conducteur",text:(x.ancien||"—")+" → "+(x.nouveau||"—")}))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const anomaly=c&&ctLast(c)&&ctDate(c)&&ctLast(c)>ctDate(c);
  return '<button class="back" type="button" data-action="back">← Retour aux véhicules</button>'+
    '<div class="detail-head page-title"><div><h1>'+escapeHtml(v.marque+" "+v.modele)+'</h1><p>'+escapeHtml(plate)+' · '+escapeHtml(v.conducteur||"Sans conducteur")+'</p></div>'+
    '<div class="row-actions">'+action("Modifier","editVehicle",plate,"secondary")+(archived(v)?"":action("Archiver","archiveVehicle",plate,"danger-btn"))+'</div></div>'+
    (anomaly?'<div class="notice error"><strong>Dates du CT à vérifier</strong><p>La date du dernier contrôle est après la prochaine échéance. Aucune date n’a été modifiée automatiquement.</p></div>':"")+
    '<div class="detail-grid"><section class="panel"><h2>Véhicule</h2>'+field("Immatriculation",plate)+field("Conducteur",v.conducteur||"Non affecté")+field("Kilométrage",km(v.kilometrage))+field("Statut",v.statut||"Actif")+
    '<div class="section-actions">'+action("Modifier la fiche","editVehicle",plate,"quiet")+'</div></section>'+
    '<section class="panel"><h2>Révision</h2>'+field("Dernière effectuée",dateView(revLast(r)))+field("Prochaine",dateView(revDate(r)))+
    (r&&revDate(r)?'<p><span class="badge '+status(revDate(r)).tone+'">'+escapeHtml(status(revDate(r)).label)+'</span></p>':"")+
    '<div class="section-actions">'+(r?action("Modifier la prochaine date","editRevision",plate)+action("Révision effectuée","newRevision",plate,"primary")+(revDate(r)&&days(revDate(r))<=30?ackButton(plate,"revision",revDate(r),r.id,r.alerteMailAcquittee):"")+action("Archiver","archiveRevision",plate,"quiet"):action("+ Renseigner une révision","addRevision",plate,"primary"))+'</div></section>'+
    '<section class="panel"><h2>Contrôle technique</h2>'+field("Dernier effectué",dateView(ctLast(c)))+field("Prochain",dateView(ctDate(c)))+
    (c&&ctDate(c)?'<p><span class="badge '+status(ctDate(c)).tone+'">'+escapeHtml(status(ctDate(c)).label)+'</span></p>':"")+
    (c&&safeLink(c.lienCt||c.lienCT)?'<p><a class="button secondary" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(safeLink(c.lienCt||c.lienCT))+'">Voir le PV</a></p>':"")+
    '<div class="section-actions">'+(c?action("Modifier la prochaine date","editCt",plate)+action("Ajouter le PV","uploadCt",plate)+(ctDate(c)&&days(ctDate(c))<=30?ackButton(plate,"ct",ctDate(c),c.id,c.alerteMailAcquittee):"")+action("Archiver","archiveCt",plate,"quiet"):action("+ Renseigner un CT","addCt",plate,"primary"))+'</div></section>'+
    '<section class="panel"><h2>Entretien et réparation</h2>'+
    (maint.filter(x=>!archived(x)).length?maint.filter(x=>!archived(x)).map(m=>'<div class="history-row"><small>'+dateView(m.date)+'</small><span class="title">'+escapeHtml(m.type||"Entretien")+'</span><span>'+escapeHtml(m.description||"")+(m.prochaineDate?" · Prochain : "+dateView(m.prochaineDate):"")+'</span><span class="row-actions">'+(m.prochaineDate&&days(m.prochaineDate)<=30?ackButton(plate,"maintenance",iso(m.prochaineDate),m.id,m.alerteMailAcquittee):"")+'<button type="button" class="button quiet" data-action="archiveMaintenance" data-id="'+escapeHtml(m.id)+'">Archiver</button></span></div>').join(""):'<div class="empty">Aucune intervention enregistrée.</div>')+
    '<div class="section-actions">'+action("+ Enregistrer une intervention","addMaintenance",plate,"primary")+'</div></section></div>'+
    '<section class="panel" style="margin-top:14px"><h2>Documents du véhicule</h2>'+(safeLink(v.lienCarteGrise)?'<div class="history-row"><small>—</small><span class="title">Carte grise</span><span>Document du véhicule</span><a class="button secondary" href="'+escapeHtml(safeLink(v.lienCarteGrise))+'" target="_blank" rel="noopener noreferrer">Voir</a></div>':"")+(documentRows(plate)||(!safeLink(v.lienCarteGrise)?'<div class="empty">Aucun document enregistré.</div>':""))+
    (c?'<div class="section-actions">'+action("Ajouter un PV de contrôle","uploadCt",plate,"secondary")+'</div>':"")+'</section>'+
    '<section class="panel"><h2>Historique</h2><h3>Révisions précédentes</h3>'+
    (revisions.length?revisions.map(x=>'<div class="history-row"><small>'+dateView(x.dateModification||x.dateCreation)+'</small><span class="title">Révision</span><span>Prévue le '+dateView(revDate(x))+'</span>'+
      (String(x.observations||"").includes("[HISTORIQUE_REVISION]")?"":'<button type="button" class="button quiet" data-action="restoreRevision" data-plate="'+escapeHtml(plate)+'" data-id="'+escapeHtml(x.id)+'">Restaurer</button>')+'</div>').join(""):'<div class="empty">Pas d’ancienne révision.</div>')+
    '<h3>Contrôles précédents</h3>'+(ctHist.length?ctHist.map(x=>'<div class="history-row"><small>'+dateView(x.dateCreation||x.date)+'</small><span class="title">'+escapeHtml(x.type||"CT")+'</span><span>'+dateView(x.date||x.nouvelleDate)+'</span>'+
      (safeLink(x.lienCt)?'<a class="button secondary" href="'+escapeHtml(safeLink(x.lienCt))+'" target="_blank" rel="noopener noreferrer">Voir</a>':"")+'</div>').join(""):'<div class="empty">Pas d’historique CT.</div>')+
    (archivedCt.length?'<h3>Contrôles archivés</h3>'+archivedCt.map(x=>'<div class="history-row"><small>'+dateView(ctLast(x))+'</small><span class="title">CT archivé</span><span>Échéance '+dateView(ctDate(x))+'</span><button type="button" class="button quiet" data-action="restoreCt" data-plate="'+escapeHtml(plate)+'" data-id="'+escapeHtml(x.id)+'">Restaurer</button></div>').join(""):"")+
    '<h3>Affectations et kilométrage</h3>'+(changes.length?changes.map(x=>'<div class="history-row"><small>'+dateView(x.date)+'</small><span class="title">'+escapeHtml(x.type)+'</span><span>'+escapeHtml(x.text)+'</span></div>').join(""):'<div class="empty">Pas de changement enregistré depuis le nouveau suivi.</div>')+
    (maint.some(archived)?'<h3>Interventions archivées</h3>'+maint.filter(archived).map(m=>'<div class="history-row"><small>'+dateView(m.date)+'</small><span class="title">'+escapeHtml(m.type)+'</span><span>'+escapeHtml(m.description)+'</span><button type="button" class="button quiet" data-action="restoreMaintenance" data-id="'+escapeHtml(m.id)+'">Restaurer</button></div>').join(""):"")+
    '</section>';
}
const input=(name,label,value="",type="text",extra="")=>'<div class="field"><label for="f-'+name+'">'+escapeHtml(label)+'</label><input id="f-'+name+'" name="'+name+'" type="'+type+'" value="'+escapeHtml(value)+'" '+extra+'></div>';
const textarea=(name,label,value="")=>'<div class="field wide"><label for="f-'+name+'">'+escapeHtml(label)+'</label><textarea id="f-'+name+'" name="'+name+'">'+escapeHtml(value)+'</textarea></div>';
const hint=text=>'<div class="field wide hint">'+escapeHtml(text)+'</div>';
function openForm(kind,plate=""){
  const v=vehicle(plate),r=activeRevision(plate),c=activeCt(plate);
  const titles={newVehicle:"Ajouter un véhicule",editVehicle:"Modifier le véhicule",addRevision:"Renseigner une révision",editRevision:"Modifier l’échéance de révision",newRevision:"Révision effectuée",addCt:"Renseigner un contrôle technique",editCt:"Modifier l’échéance du CT",addMaintenance:"Enregistrer une intervention",uploadCt:"Ajouter un PV de contrôle"};
  let html="";
  if(kind==="newVehicle"||kind==="editVehicle"){
    html=input("immatriculation","Immatriculation *",v?.immatriculation||"","text","required autocapitalize=\"characters\"")+
      input("marque","Marque *",v?.marque||"","text","required")+input("modele","Modèle *",v?.modele||"","text","required")+
      input("annee","Année",v?.annee||"","number",'min="1950" max="2100"')+input("conducteur","Conducteur",v?.conducteur||"")+
      input("kilometrage","Kilométrage (facultatif)",v?.kilometrage??"","number",'min="0" step="1" inputmode="numeric"')+
      '<div class="field"><label for="f-statut">Statut</label><select id="f-statut" name="statut">'+["Actif","En entretien","Sortie du parc"].map(x=>'<option '+(v?.statut===x?"selected":"")+'>'+x+'</option>').join("")+'</select></div>';
  }else if(kind.includes("Revision")){
    html=hint("Véhicule : "+plate)+
      input("dernierDate",kind==="newRevision"?"Date reportée comme effectuée":"Dernière révision effectuée",kind==="newRevision"?revDate(r):revLast(r),"date",kind==="editRevision"||kind==="newRevision"?"readonly":"")+
      input("prochainDate","Prochaine révision *",kind==="editRevision"?revDate(r):"","date","required")+
      (kind==="newRevision"?hint("La date prévue "+dateView(revDate(r))+" sera conservée comme dernière révision effectuée. Vérifie qu’elle correspond bien à l’intervention."):hint("La date effectuée ne se modifie plus après l’enregistrement."));
  }else if(kind==="addCt"||kind==="editCt"){
    html=hint("Véhicule : "+plate)+input("dernierDate","Dernier contrôle effectué",ctLast(c),"date",kind==="editCt"?"readonly":"")+
      input("prochainDate","Prochain contrôle *",kind==="editCt"?ctDate(c):"","date","required")+
      hint("Le prochain contrôle reste à la date que tu enregistres. Aucune date n’est avancée automatiquement.");
  }else if(kind==="addMaintenance"){
    html=hint("Véhicule : "+plate)+
      '<div class="field"><label for="f-type">Type d’intervention *</label><select id="f-type" name="type" required><option>Révision</option><option>Entretien</option><option>Réparation</option><option>Pneus</option><option>Autre</option></select></div>'+
      input("date","Date effectuée *",todayParis(),"date","required")+
      textarea("description","Travaux réalisés")+input("kilometrage","Kilométrage (facultatif)","","number",'min="0" step="1"')+
      input("montant","Montant € (facultatif)","","number",'min="0" step="0.01"')+
      input("prestataire","Garage / prestataire")+input("prochaineDate","Prochaine échéance (facultative)","","date");
  }else if(kind==="uploadCt"){
    html=hint("Véhicule : "+plate)+input("file","Document de contrôle *","","file",'required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"')+
      hint("PDF, JPG, JPEG ou PNG · 10 Mo maximum. Le document sera conservé dans Drive et visible depuis cette fiche.");
  }
  state.form={kind,plate};$("#dialogTitle").textContent=titles[kind]||"Saisie";
  $("#formFields").innerHTML=html;$("#submitDialog").textContent=kind==="uploadCt"?"Ajouter le document":"Enregistrer";
  $("#formDialog").showModal();
  $("#formFields input:not([readonly]),#formFields select").focus();
}
async function submitForm(event){
  event.preventDefault();if(state.busy||!state.form)return;
  const form=$("#editorForm");
  if(!form.reportValidity())return;
  const {kind,plate}=state.form;
  const fd=new FormData(form),value=n=>String(fd.get(n)||"").trim();
  const payload={immatriculation:plate};
  let action="";
  if(kind==="newVehicle"||kind==="editVehicle"){
    action=kind==="newVehicle"?"createVehicule":"updateVehicule";
    Object.assign(payload,{ancienneImmatriculation:plate||value("immatriculation"),immatriculation:value("immatriculation").toUpperCase(),
      marque:value("marque"),modele:value("modele"),annee:value("annee"),conducteur:value("conducteur"),statut:value("statut")});
    if(value("kilometrage")!=="")payload.kilometrage=Number(value("kilometrage"));
    else if(kind==="newVehicle")payload.kilometrage="";
  }else if(kind==="addRevision"||kind==="editRevision"||kind==="newRevision"){
    action={addRevision:"createRevision",editRevision:"updateRevision",newRevision:"nouvelleRevision"}[kind];
    Object.assign(payload,{dernierDate:value("dernierDate"),prochainDate:value("prochainDate")});
    if(kind==="newRevision"&&!confirm("Confirmer la révision effectuée à la date "+dateView(value("dernierDate"))+" ?"))return;
  }else if(kind==="addCt"||kind==="editCt"){
    action=kind==="addCt"?"createControleTk":"updateControleTk";
    Object.assign(payload,{dernierDate:value("dernierDate"),prochainDate:value("prochainDate")});
  }else if(kind==="addMaintenance"){
    action="createMaintenance";Object.assign(payload,{date:value("date"),type:value("type"),description:value("description"),
      kilometrage:value("kilometrage"),montant:value("montant"),prestataire:value("prestataire"),prochaineDate:value("prochaineDate")});
  }else if(kind==="uploadCt"){
    const file=fd.get("file");
    if(!(file instanceof File))return toast("Choisis un fichier.",true);
    const allowed=["application/pdf","image/jpeg","image/png"];
    const extension=/\.(pdf|jpe?g|png)$/i.test(file.name);
    if(!extension||!allowed.includes(file.type))return toast("Formats autorisés : PDF, JPG, JPEG, PNG.",true);
    if(file.size>10*1024*1024)return toast("Le document dépasse 10 Mo.",true);
    action="uploadCtFile";Object.assign(payload,{fileName:file.name,nom:file.name,mimeType:file.type,date:todayParis(),
      fileBase64:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error("Lecture du fichier impossible"));reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.readAsDataURL(file)})});
  }
  state.busy=true;$("#submitDialog").disabled=true;$("#submitDialog").textContent="Enregistrement…";
  try{
    await request(action,payload);
    $("#formDialog").close();state.form=null;
    if(kind==="newVehicle")state.view="vehicles";
    if(kind==="editVehicle")state.vehicle=payload.immatriculation;
    await load({quiet:true});toast("Enregistré.");
  }catch(e){toast(e.message,true)}
  finally{state.busy=false;$("#submitDialog").disabled=false;$("#submitDialog").textContent="Enregistrer"}
}
async function runAction(el){
  const action=el.dataset.action,plate=el.dataset.plate||state.vehicle,id=el.dataset.id;
  if(action==="addAddress"){$(el.dataset.kind==="to"?"#mailTo":"#mailCc").insertAdjacentHTML("beforeend",addressRow(el.dataset.kind));return}
  if(action==="removeAddress"){el.closest(".address-row").remove();return}
  if(action==="reload")return load();
  if(action==="back"){state.view="vehicles";render();return}
  if(action==="detail"){state.vehicle=plate;state.view="detail";render();scrollTo(0,0);return}
  if(action==="ackMail"){
    if(state.busy)return;
    state.busy=true;el.disabled=true;
    try{await request("setAlerteMail",{immatriculation:plate,type:el.dataset.type,date:el.dataset.date,id,acquitter:el.dataset.acquit!=="true"});await load({quiet:true});toast(el.dataset.acquit==="true"?"Rappels réactivés.":"Pris en charge : plus de mail pour cette échéance.")}
    catch(e){toast(e.message,true);el.disabled=false}
    finally{state.busy=false}
    return;
  }
  if(["newVehicle","editVehicle","addRevision","editRevision","newRevision","addCt","editCt","addMaintenance","uploadCt"].includes(action))return openForm(action,plate);
  const mapping={archiveVehicle:"archiveVehicule",restoreVehicle:"restoreVehicule",archiveRevision:"archiveRevision",restoreRevision:"restoreRevision",
    archiveCt:"archiveControleTk",restoreCt:"restoreControleTk",archiveMaintenance:"archiveMaintenance",restoreMaintenance:"restoreMaintenance"};
  if(!mapping[action]||state.busy)return;
  if(!confirm((action.startsWith("archive")?"Archiver":"Restaurer")+" cet élément ?"))return;
  state.busy=true;el.disabled=true;
  try{
    await request(mapping[action],{immatriculation:plate,id});
    if(action==="archiveVehicle"){state.view="vehicles";state.filter="archived";state.query=plate}
    if(action==="restoreVehicle"){state.filter="active";state.query=plate}
    await load({quiet:true});toast(action.startsWith("archive")?"Archivé.":"Restauré.");
  }
  catch(e){toast(e.message,true);el.disabled=false}
  finally{state.busy=false}
}
document.addEventListener("click",e=>{
  const button=e.target.closest("[data-action]");if(button)return runAction(button);
  const tab=e.target.closest("[data-view]");if(tab){if(state.view==="expenses"&&window.Expenses&&!window.Expenses.allowLeave())return;state.vehicle=null;if(tab.dataset.view==="expenses")openExpenses();else if(tab.dataset.view==="settings")openSettings();else{state.view=tab.dataset.view;render()}scrollTo(0,0)}
});
document.addEventListener("submit",async e=>{
  if(e.target.id==="loginForm"){
    e.preventDefault();const button=e.target.querySelector("button");button.disabled=true;button.textContent="Connexion en cours…";
    const previous=e.target.parentElement.querySelector(".notice.error");if(previous)previous.remove();
    try{const result=await request("loginAndReadParc",{pin:$("#accessPin").value});const {token,...data}=result;state.token=token;state.data=data;state.lastSync=Date.now();state.stale=false;localStorage.setItem(SESSION_KEY,JSON.stringify({token,expiresAt:Date.now()+5*3600000+45*60000}));saveParcCache();render()}
    catch(error){button.disabled=false;button.textContent="Ouvrir le parc";const notice=document.createElement("p");notice.className="notice error";notice.textContent=error.message;e.target.after(notice)}
  }
  if(e.target.id==="mailSettingsForm"){
    e.preventDefault();const to=$$("#mailTo input").map(x=>x.value.trim()),cc=$$("#mailCc input").map(x=>x.value.trim());
    const button=e.target.querySelector("button[type=submit]");button.disabled=true;
    try{state.mailSettings=await request("saveMailSettings",{to,cc});render();toast("Adresses enregistrées.")}
    catch(error){toast(error.message,true);button.disabled=false}
  }
});
document.addEventListener("input",e=>{if(e.target.id==="search"){state.query=e.target.value;const pos=e.target.selectionStart;render();$("#search").focus();$("#search").setSelectionRange(pos,pos)}});
document.addEventListener("change",e=>{if(e.target.id==="filter"){state.filter=e.target.value;render()}});
$("#refreshButton").addEventListener("click",()=>state.view==="expenses"?window.Expenses?.open():load({quiet:true}));
$("#logoutButton").addEventListener("click",()=>{clearAccess();renderLogin()});
$("#closeDialog").addEventListener("click",()=>$("#formDialog").close());
$("#cancelDialog").addEventListener("click",()=>$("#formDialog").close());
$("#editorForm").addEventListener("submit",submitForm);
restoreParcCache();if(state.data)render();load({quiet:Boolean(state.data)});


