import { createHash } from 'node:crypto';

export const fingerprint = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export function checklistItems(items, shared = false) {
  return items.map(item => ({
    ...(shared ? {item_key: item.item_key} : {}),
    section_code: shared ? item.section_code : item.section_code.trim(),
    title: shared ? item.title : item.title.trim(),
    description: item.description ?? null,
    is_required: item.is_required ?? (!shared && item.section_code.split('.').filter(Boolean).length === 3),
  })).map(row => JSON.stringify(row)).sort();
}
export function assertChecklistItems(expected, actual, shared = false) {
  if (JSON.stringify(checklistItems(expected, shared)) !== JSON.stringify(checklistItems(actual, shared))) {
    throw new Error('Saved checklist tasks differ from the reviewed complete inventory.');
  }
}
export function assertPageFields(expected, actual) {
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(value)) throw new Error(`Saved checklist page differs at ${key}.`);
  }
}
export function retainChecklistIds(items, saved) {
  const available=new Map();
  for(const row of saved) {
    const key=JSON.stringify([row.section_code,row.title]);
    const matches=available.get(key)||[];matches.push(row.id);available.set(key,matches);
  }
  return items.map(item=>{
    const normalized={section_code:item.section_code.trim(),title:item.title.trim(),description:item.description??null,is_required:item.is_required??item.section_code.split('.').filter(Boolean).length===3};
    const id=available.get(JSON.stringify([normalized.section_code,normalized.title]))?.shift();
    return {...normalized,...(id?{id}:{})};
  });
}
