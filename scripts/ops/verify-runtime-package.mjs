import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const [sha,root,directory]=process.argv.slice(2);
const receipt=JSON.parse(fs.readFileSync(path.join(directory,'receipt.json'),'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(receipt.sha!==sha||receipt.lockHash!==hash(path.join(root,'package-lock.json'))||receipt.archiveHash!==hash(path.join(directory,'dependencies.tgz'))||receipt.platform!==process.platform||receipt.arch!==process.arch||receipt.nodeMajor!==Number(process.versions.node.split('.')[0])) throw new Error('Runtime package does not match released source, dependencies or host.');
