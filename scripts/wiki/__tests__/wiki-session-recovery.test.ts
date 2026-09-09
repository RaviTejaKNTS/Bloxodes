import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readSessionState, saveSessionState, recoverStep } from '../wiki-session-recovery';

test('failed publication resumes the saved session and retries the operation', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'wiki-recovery-'));const file=path.join(dir,'state.json');
 try {
  await saveSessionState(file,{sessionId:'same-session',repairs:0});let fixed=false;let calls=0;
  const result=await recoverStep({file,label:'publish',operation:async()=>{calls++;if(!fixed)throw Error('oversize image');return 'published';},repair:async(id,error)=>{assert.equal(id,'same-session');assert.match(error,/oversize image/);fixed=true;}});
  assert.equal(result,'published');assert.equal(calls,2);assert.equal((await readSessionState(file)).repairs,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('repair budget survives process retries and failed repair turns', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'wiki-recovery-'));const file=path.join(dir,'state.json');
 try {
  await saveSessionState(file,{sessionId:'same-session',repairs:2});let repairs=0;
  const options={file,label:'publish',operation:async()=>{throw Error('bad media');},repair:async()=>{repairs++;throw Error('provider failure');}};
  await assert.rejects(recoverStep(options),/provider failure/);
  await assert.rejects(recoverStep(options),/bad media/);
  assert.equal(repairs,1);assert.equal((await readSessionState(file)).repairs,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('legacy artifacts without a saved session never trigger a new paid conversation', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'wiki-recovery-'));const file=path.join(dir,'state.json');
 try {await assert.rejects(recoverStep({file,label:'sync',operation:async()=>{throw Error('network');},repair:async()=>{assert.fail('must not start a session');}}),/network/);}
 finally{await rm(dir,{recursive:true,force:true});}
});
