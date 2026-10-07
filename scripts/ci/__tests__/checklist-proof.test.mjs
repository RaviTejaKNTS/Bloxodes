import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertChecklistItems, assertPageFields,retainChecklistIds} from '../checklist-proof.mjs';

test('matches importer defaults, whitespace and unordered rows without losing duplicate counts', () => {
  const source = [{section_code:'1',title:' Section '},{section_code:'1.1.1',title:' Task ',description:null}];
  const saved = [{section_code:'1.1.1',title:'Task',description:null,is_required:true},{section_code:'1',title:'Section',description:null,is_required:false}];
  assertChecklistItems(source,saved);
  assert.throws(()=>assertChecklistItems([...source,source[0]],saved));
  for (const key of ['title','description','section_code','is_required']) {
    const changed=structuredClone(saved); changed[0][key]=key==='is_required'?false:'wrong';
    assert.throws(()=>assertChecklistItems(source,changed));
  }
});
test('description edits retain progress IDs while new tasks and duplicate rows remain distinct',()=>{
  const saved=[{id:'first',section_code:'1.1.1',title:'Task'},{id:'second',section_code:'1.1.1',title:'Task'}];
  const rows=retainChecklistIds([{section_code:'1.1.1',title:' Task ',description:'New context'},{section_code:'1.1.1',title:'Task'},{section_code:'1.1.1',title:'New task'}],saved);
  assert.equal(rows[0].id,'first');assert.equal(rows[1].id,'second');assert.equal(rows[2].id,undefined);
});
test('shared tasks retain item keys and shared required defaults', () => {
  const source=[{item_key:'task',section_code:'1.1.1',title:'Task'}];
  assertChecklistItems(source,[{...source[0],description:null,is_required:false}],true);
  assert.throws(()=>assertChecklistItems(source,[{...source[0],item_key:'other'}],true));
  assert.throws(()=>assertPageFields({title:'Reviewed',description_md:null},{title:'Other',description_md:null}));
});
