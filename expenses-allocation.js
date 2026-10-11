/* Split an unassigned charge while preserving exact invoice totals. */
var ExpenseAllocation={split:function(line,amount,target,kind){
 const ht=line.amounts.ht;
 if(!Number.isSafeInteger(ht)||ht<=0||!Number.isSafeInteger(amount)||amount<=0||amount>ht)throw Error('Montant HT à affecter : supérieur à zéro et inférieur ou égal au reste.');
 if(!target)throw Error('Choisir un conducteur ou un véhicule.');
 if(line.maintenanceId)throw Error('Retirer le lien avec un entretien avant de répartir cette opération.');
 const assigned=JSON.parse(JSON.stringify(line)),remaining=JSON.parse(JSON.stringify(line));
 assigned.plate=kind==='vehicle'?target:'';assigned.personId=kind==='driver'?target:'';assigned.scope='assigned';
 remaining.plate='';remaining.personId='';remaining.scope='unassigned';
 const vat=line.amounts.vat===null?null:Math.round(line.amounts.vat*amount/ht);
 assigned.amounts={ht:amount,vat:vat,ttc:line.amounts.ttc===null?null:vat!==null?amount+vat:Math.round(line.amounts.ttc*amount/ht)};
 for(const k of ['ht','vat','ttc'])remaining.amounts[k]=line.amounts[k]===null?null:line.amounts[k]-assigned.amounts[k];
 if(line.litres!==null&&line.litres!==undefined){assigned.litres=line.litres*amount/ht;remaining.litres=line.litres-assigned.litres;}
 return amount===ht?[assigned]:[remaining,assigned];
}};
if(typeof module!=='undefined')module.exports=ExpenseAllocation;
