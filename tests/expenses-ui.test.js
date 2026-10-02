'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../expenses-core');
test('Lazy module renders overview, isolated invoice editor, reference forms and invoice history',async()=>{
 const listeners={},snapshot={invoices:[{id:'i1',supplier:'easypark',account:'Compte A',number:'FA1',date:'2026-09-30',period:'2026-09',revision:1,status:'active',note:'<script>untrusted</script>',documents:[{name:'facture.pdf',url:'https://drive.google.com/file/d/test/view'}],totals:{ht:1000,vat:200,ttc:1200},lines:[{category:'parking',date:'2026-09-15',month:'2026-09',label:'<img onerror=x>',scope:'unassigned',plate:'AA123AA',personId:'',amounts:{ht:1000,vat:200,ttc:1200},litres:null}]}],people:[{id:'p1',name:'Kevin',reference:'A'},{id:'p2',name:'Kevin',reference:'B'}],mappings:[],completion:{},audit:[]};
 let html='';const context={window:{},ExpenseRules:R,escapeHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),todayParis:()=> '2026-09-15',dateView:v=>v,iso:v=>v,list:k=>k==='vehicules'?[{immatriculation:'AA123AA',marque:'TEST',modele:'TEST'}]:[],archived:()=>false,safeLink:s=>s,document:{addEventListener:(k,f)=>listeners[k]=f},state:{view:'expenses'},request:async()=>snapshot,title:(n,s,b='')=>'<h1>'+n+'</h1><p>'+s+'</p>'+b,toast:()=>{},confirm:()=>true,crypto:require('node:crypto').webcrypto,URL};
 context.window.render=()=>{html=context.window.Expenses.render();};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../expenses.js'),'utf8'),context);
 await context.window.Expenses.open();assert.match(html,/Dépenses suivies/);assert.match(html,/10,00/);assert.ok(!html.includes("12,00"));assert.ok(!html.includes("TTC"));assert.ok(!html.includes('name="basis"'));
 snapshot.invoices[0].lines[0].amounts.ht=null;context.window.render();assert.match(html,/HT à vérifier/);assert.match(html,/total partiel/);assert.ok(!html.includes("12,00"));snapshot.invoices[0].lines[0].amounts.ht=1000;context.window.render();assert.ok(!html.includes('<img onerror'));assert.match(html,/À affecter/);assert.match(html,/value="p1"/);assert.match(html,/value="p2"/);
 function click(action,fields={}){listeners.click({target:{closest:()=>({dataset:{exp:action,...fields}})},preventDefault(){}});}
 click('new');assert.match(html,/expenseDraft/);assert.match(html,/Lecture automatique non validée/);assert.ok(!html.includes('<dialog'));assert.match(html,/invoiceFile/);
 click('back');click('references');assert.match(html,/expensePerson/);assert.match(html,/expenseMapping/);
 click('back');click('completion');assert.match(html,/expenseCompletion/);
 click('back');click('invoice',{id:'i1'});assert.match(html,/Historique des modifications/);assert.match(html,/facture.pdf/);assert.ok(!html.includes('<script>untrusted'));
 click('edit');assert.match(html,/Motif de correction/);assert.ok(!html.includes('name="invoiceFile"'));
 context.window.Expenses.reset();assert.match(context.window.Expenses.render(),/Chargement/);
});
