import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchingArticleRun,articleRunOutcome} from '../article-publication-state.mjs';
const intent={dispatchHash:'a'.repeat(64),submittedAt:'2026-10-07T00:00:00.100Z'};
const run={id:42,display_title:`Selected content ${intent.dispatchHash}`,event:'workflow_dispatch',head_branch:'production',created_at:'2026-10-07T00:00:01Z',status:'in_progress'};
test('matches only the exact batch, submission, branch and recorded run',()=>{
  assert.equal(matchingArticleRun([run],intent),run);
  for(const change of [{display_title:'Other'},{head_branch:'feature'},{event:'push'},{created_at:'2026-10-06T23:59:59Z'}]) assert.equal(matchingArticleRun([{...run,...change}],intent),null);
  assert.equal(matchingArticleRun([run],{...intent,githubRunId:43}),null);
});
test('pending and successful runs never authorize redispatch',()=>{
  assert.equal(articleRunOutcome(null),'pending');
  assert.equal(articleRunOutcome(run),'pending');
  assert.equal(articleRunOutcome({...run,status:'queued'}),'pending');
  assert.equal(articleRunOutcome({...run,status:'completed',conclusion:'success'}),'receipt-needed');
  for(const conclusion of ['failure','cancelled','timed_out']) assert.equal(articleRunOutcome({...run,status:'completed',conclusion}),'retry');
});
