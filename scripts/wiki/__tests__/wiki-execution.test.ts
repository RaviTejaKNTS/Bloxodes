import test from "node:test";
import assert from "node:assert/strict";
import { wikiCodexArgs, wikiSandboxProbeArgs, isWikiTechnicalFailure, wikiFailureMessage } from "../wiki-execution";

test('sandbox readiness supports both CLI command generations without bypassing restrictions', () => {
  const current = wikiSandboxProbeArgs('/state/game', '--permission-profile <NAME>');
  assert.deepEqual(current.slice(0, 3), ['sandbox', '--permission-profile', 'wiki-readiness']);
  assert.ok(current.includes('permissions.wiki-readiness.network.enabled=true'));
  assert.ok(current.includes('permissions.wiki-readiness.filesystem={"/state/game"="write"}'));
  const previous = wikiSandboxProbeArgs('/state/game', 'Commands:\n  linux Run a command');
  assert.deepEqual(previous.slice(0, 2), ['sandbox', 'linux']);
  assert.ok(previous.includes('sandbox_workspace_write.network_access=true'));
});

test('new and resumed sessions retain network, writable artifacts and sandbox restrictions', () => {
  for (const input of [['exec','--approve-for-me','--ephemeral','prompt'],['exec','resume','--json','session','prompt']]) {
    const args=wikiCodexArgs(input,'/state/game/attempt-1');
    assert.equal(args[args.indexOf('--sandbox')+1],'workspace-write');
    assert.ok(args.includes('sandbox_workspace_write.network_access=true'));
    assert.ok(args.includes('sandbox_workspace_write.writable_roots=["/state/game/attempt-1"]'));
    assert.ok(!args.includes('--ephemeral'));assert.ok(!args.includes('--approve-for-me'));
    assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
    if(input.includes('resume'))assert.ok(args.indexOf('resume')>args.indexOf('--add-dir'));
  }
});
test('technical blockers remain recoverable, evidence gaps remain editorial', () => {
  for(const error of ['Supabase ENOTFOUND','preview EPERM','bwrap: read-only filesystem','Published wiki URLs are not yet in the sitemap','Browser runtime had no available backend','registry-only seed cannot recognize the unregistered hub','workspace routing discovery timed out'])assert.equal(isWikiTechnicalFailure(error),true);
  assert.equal(isWikiTechnicalFailure('No reliable source identifies these weapons.'),false);
  assert.match(wikiFailureMessage('bwrap: Cannot mkdir .aws: Read-only file system','Missing workflow-result.json'),/bwrap:.*Missing workflow/);
});
