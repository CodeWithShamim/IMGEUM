// Copies ABIs and the deployment-addresses artifact from the Foundry project into the web
// app, so contract addresses and ABIs are NEVER hand-copied (build spec §7). Run after every
// `forge build` / deploy:  node scripts/sync-contracts.mjs
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const contracts = join(web, '..', 'contracts');

const abiDir = join(web, 'src', 'config', 'abis');
mkdirSync(abiDir, {recursive: true});

for (const name of ['EmployerRegistry', 'WageVault', 'ArrearsAttestor']) {
  const artifact = join(contracts, 'out', `${name}.sol`, `${name}.json`);
  if (!existsSync(artifact)) {
    console.warn(`skip ${name}: ${artifact} not found (run \`forge build\` first)`);
    continue;
  }
  const {abi} = JSON.parse(readFileSync(artifact, 'utf8'));
  writeFileSync(join(abiDir, `${name}.json`), JSON.stringify(abi, null, 2));
  console.log(`abi  ${name} (${abi.length} entries)`);
}

// Deployment artifacts, keyed by chain id, produced by script/Deploy.s.sol.
const deployDir = join(contracts, 'deployments');
const outDeployments = join(web, 'src', 'config', 'deployments.json');
const merged = {};
if (existsSync(deployDir)) {
  for (const f of readdirSync(deployDir)) {
    if (!f.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(join(deployDir, f), 'utf8'));
    merged[String(data.chainId)] = data;
    console.log(`addr chain ${data.chainId}`);
  }
}
writeFileSync(outDeployments, JSON.stringify(merged, null, 2));
console.log(`wrote ${outDeployments}`);
