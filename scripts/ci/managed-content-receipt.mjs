import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function contentDigest(base) {
  const hash=createHash('sha256');
  function read(directory) {
    for(const name of fs.readdirSync(directory).sort()) {
      const file=path.join(directory,name); const info=fs.lstatSync(file);
      if(info.isSymbolicLink()) throw new Error('QA inputs cannot contain symlinks.');
      if(info.isDirectory()) read(file);
      else {const bytes=fs.readFileSync(file);hash.update(JSON.stringify([path.relative(base,file),bytes.length]));hash.update(bytes);}
    }
  }
  read(base);return hash.digest('hex');
}
if(process.argv[1]?.endsWith('/managed-content-receipt.mjs')) {
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.BLOXODES_MANAGED_QA!=='true') throw new Error('QA receipts are written only on GitHub.');
  const receipt={status:'passed',sha:process.env.BLOXODES_APPROVED_SHA,runId:process.env.GITHUB_RUN_ID,digest:contentDigest(path.dirname(process.env.BATCH))};
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'managed-content-receipt.json'),JSON.stringify(receipt));
}
