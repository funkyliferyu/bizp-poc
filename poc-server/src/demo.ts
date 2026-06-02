import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runDemoFlow } from './workflows/runDemoFlow.js';

const approval = await runDemoFlow();
const outputDir = path.resolve('data/approvals');
await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${approval.approvalId}.json`);
await writeFile(outputPath, `${JSON.stringify(approval, null, 2)}\n`, 'utf8');

console.log(`Approval package generated: ${outputPath}`);
console.log(JSON.stringify(approval, null, 2));
