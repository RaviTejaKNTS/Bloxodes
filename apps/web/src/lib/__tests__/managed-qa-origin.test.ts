import {NextRequest} from 'next/server';
import {afterEach,expect,it,vi} from 'vitest';
import {proxy} from '@/proxy';
import {isTrustedMutationOrigin} from '@/lib/security/request';

afterEach(()=>vi.unstubAllEnvs());
it('keeps the mapped test host local only for managed GitHub QA',()=>{
  vi.stubEnv('GITHUB_ACTIONS','true');vi.stubEnv('BLOXODES_MANAGED_QA','true');
  const response=proxy(new NextRequest('http://bloxodes.test:3000/games',{headers:{host:'bloxodes.test:3000'}}));
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('strict-transport-security')).toBeNull();
  const mutation=new Request('http://bloxodes.test:3000/api/checklists/progress',{method:'PUT',headers:{host:'bloxodes.test:3000',origin:'http://bloxodes.test:3000'}});
  expect(isTrustedMutationOrigin(mutation)).toBe(true);
  for(const [github,managed] of [['false','true'],['true','false']]) {
    vi.stubEnv('GITHUB_ACTIONS',github);vi.stubEnv('BLOXODES_MANAGED_QA',managed);
    expect(proxy(new NextRequest('http://bloxodes.test:3000/games',{headers:{host:'bloxodes.test:3000'}})).headers.get('location')).toBe('http://bloxodes.com/games');
  }
});
it('does not allow a different browser origin to mutate the QA account',()=>{
  vi.stubEnv('GITHUB_ACTIONS','true');vi.stubEnv('BLOXODES_MANAGED_QA','true');
  const request=new Request('http://bloxodes.test:3000/api/checklists/progress',{method:'PUT',headers:{host:'bloxodes.test:3000',origin:'https://other.test'}});
  expect(isTrustedMutationOrigin(request)).toBe(false);
  expect(proxy(new NextRequest('http://other.test:3000/games',{headers:{host:'other.test:3000'}})).headers.get('location')).toBe('http://bloxodes.com/games');
});
