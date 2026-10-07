import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const script=path.resolve('scripts/ops/relocate-automation-state.py');
function fixture() {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-state-'));
  const legacy=path.join(base,'legacy'),root=path.join(base,'hdd');
  fs.mkdirSync(path.join(legacy,'state'),{recursive:true});fs.mkdirSync(root);
  fs.writeFileSync(path.join(legacy,'state','draft.json'),'retained authoring',{mode:0o600});
  fs.symlinkSync(path.join(legacy,'state'),path.join(root,'state'));
  return {base,legacy,root};
}
test('relocation retains file bytes and modes while both paths resolve to HDD',()=>{
  const {base,legacy,root}=fixture();
  try {
    execFileSync('python3',[script,legacy,root]);
    assert.equal(fs.realpathSync(path.join(legacy,'state')),path.join(root,'state'));
    assert.equal(fs.readFileSync(path.join(root,'state','draft.json'),'utf8'),'retained authoring');
    assert.equal(fs.statSync(path.join(root,'state','draft.json')).mode&0o777,0o600);
    assert.equal(fs.existsSync(path.join(legacy,'state.before-hdd')),false);
  } finally {fs.rmSync(base,{recursive:true,force:true});}
});
test('an incomplete copy is refused without removing original state',()=>{
  const {base,legacy,root}=fixture();
  try {
    fs.mkdirSync(path.join(root,'state.copying'));
    assert.throws(()=>execFileSync('python3',[script,legacy,root],{stdio:'pipe'}));
    assert.equal(fs.readFileSync(path.join(legacy,'state','draft.json'),'utf8'),'retained authoring');
    assert.equal(fs.lstatSync(path.join(root,'state')).isSymbolicLink(),true);
  } finally {fs.rmSync(base,{recursive:true,force:true});}
});
test('a verified copy resumes after the legacy directory was renamed',()=>{
  const {base,legacy,root}=fixture();
  try {
    execFileSync('python3',[script,legacy,root]);
    fs.unlinkSync(path.join(legacy,'state'));
    fs.cpSync(path.join(root,'state'),path.join(legacy,'state.before-hdd'),{recursive:true,preserveTimestamps:true});
    execFileSync('python3',[script,legacy,root]);
    assert.equal(fs.realpathSync(path.join(legacy,'state')),path.join(root,'state'));
    assert.equal(fs.existsSync(path.join(legacy,'state.before-hdd')),false);
  } finally {fs.rmSync(base,{recursive:true,force:true});}
});
