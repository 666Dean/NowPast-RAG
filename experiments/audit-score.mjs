// Versioned corrected scorer used only for new audits, never rewrite old scores.
import {setMetrics} from './engine.mjs';
export function scoreAuditCase({fields,gold,directOldIds=[],transitiveOldIds=[],selected=[],previous=[],error=null}){
  if(error)return {runtimeFailure:true,semanticTimeError:null,semanticRangeError:null,questionExact:0,coverage:0};
  const perField=fields.map(field=>{
    const expected=gold.filter(g=>g.field===field),actual=selected.filter(s=>s.field===field),values=[...new Set(expected.map(g=>g.value))];
    return {field,...setMetrics(actual.map(s=>s.value),values),conflict:values.length>1,
      citationExact:setMetrics(actual.map(s=>s.id),expected.map(g=>g.id)).exact,missing:values.length===0,abstained:actual.length===0};
  });
  return {runtimeFailure:false,perField,questionExact:Number(perField.every(s=>s.exact&&s.citationExact)),coverage:perField.filter(s=>!s.abstained).length/fields.length,
    directOldLink:setMetrics(previous,directOldIds),transitiveOldLink:setMetrics(previous,transitiveOldIds),oldNonempty:transitiveOldIds.length>0};
}
