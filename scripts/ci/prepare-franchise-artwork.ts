import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {artworkR2Fetch, runArtwork} from './franchise-artwork.mjs';
import {loadR2ClientConfig, R2Client} from '../shared/r2-client';

const output = 'tmp/test-reports/franchise-artwork';
async function main() {
  if (process.argv.length !== 2) throw new Error('Artwork accepts only its explicit workflow inputs.');
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8', timeout: 10_000}).trim();
  const report = await runArtwork({
    env: process.env, checkoutSha,
    createStore(assets: Array<{key: string}>) {
      const config = loadR2ClientConfig(process.env);
      return new R2Client(config, artworkR2Fetch(config, assets));
    },
    async saveArtifacts(assets: Array<{role: string; mime: string; body: Buffer}>) {
      await fs.mkdir(output, {recursive: true});
      for (const asset of assets) await fs.writeFile(`${output}/${asset.role}.${asset.mime === 'image/png' ? 'png' : 'jpg'}`, asset.body, {flag: 'wx'});
    },
    async saveReport(value: unknown) {
      await fs.writeFile(`${output}/report.json`, JSON.stringify(value, null, 2));
    }
  });
  console.log(`Artwork ${report.status}; inspect the derived assets and report before hub writing.`);
}
main().catch(() => {
  // Neither transport/library errors nor input bytes may expose secrets in logs.
  console.error('Artwork preparation failed. No content was published. Inspect any saved report and the approved inputs.');
  process.exitCode = 1;
});
