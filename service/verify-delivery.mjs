import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const withModel = process.argv.includes('--model');
if (withModel) {
  assert.ok(process.env.NOWPAST_MODEL_HOME, 'Set NOWPAST_MODEL_HOME to the prepared model cache.');
}
const scratch = await mkdtemp(join(tmpdir(), 'nowpast-delivery-'));
const checkout = join(scratch, 'project');
const output = new URL('./validation/delivery-check.json', import.meta.url);

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: checkout,
    env: process.env,
    stdio: 'inherit',
    timeout: 300000
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Command failed: node ${args.join(' ')}`);
}

try {
  // Use versioned files and new delivery files, excluding ignored model caches.
  const filenames = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8'
  }).split('\0').filter(Boolean);
  for (const filename of new Set(filenames)) {
    const target = join(checkout, filename);
    await mkdir(dirname(target), {recursive: true});
    await copyFile(join(root, filename), target);
  }

  run(['--test', 'retrieval/regression.test.mjs', 'generation/citations.test.mjs']);
  run(['evaluation/run.mjs']);
  const results = JSON.parse(await readFile(join(checkout, 'evaluation/results.json'), 'utf8'));
  const failedCurrent = results.rows.filter(row => !row.unboundedExact || !row.scores.NowPast.exact);
  const failedRoles = results.rows.filter(row => row.gnp && !row.gnp.exact);
  const failedResearch = results.researchRows.filter(row => !row.pass);
  const failedBehavior = results.behaviorTests.filter(row => !row.pass);
  assert.ok(results.rows.length > 0, 'No evaluation cases found.');
  assert.ok(results.researchRows.length > 0, 'No research cases found.');
  assert.ok(results.behaviorTests.length > 0, 'No behavior cases found.');
  assert.deepEqual(failedCurrent.map(row => row.id), [], 'Current evidence regression.');
  assert.deepEqual(failedRoles.map(row => row.id), [], 'Temporal evidence role regression.');
  assert.deepEqual(failedResearch.map(row => row.id), [], 'Research source regression.');
  assert.deepEqual(failedBehavior.map(row => row.name), [], 'Behavior regression.');

  run(['service/verify-service.mjs', ...(withModel ? ['--model'] : [])]);
  const api = JSON.parse(await readFile(join(checkout, 'service/validation/api-results.json'), 'utf8'));
  const validationInputs = {};
  for (const filename of ['service/verify-delivery.mjs', 'service/verify-service.mjs', 'retrieval/regression.test.mjs', 'generation/citations.test.mjs']) {
    validationInputs[filename] = createHash('sha256').update(await readFile(join(checkout, filename))).digest('hex');
  }
  const report = {
    passed: true,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    inputs: results.inputs,
    validationInputs,
    environment: {node: process.version, platform: process.platform, arch: process.arch},
    currentEvidence: {passed: results.rows.length, total: results.rows.length},
    evidenceRoles: {passed: results.rows.filter(row => row.gnp).length, total: results.rows.filter(row => row.gnp).length},
    researchSources: {passed: results.researchRows.length, total: results.researchRows.length},
    behavior: {passed: results.behaviorTests.length, total: results.behaviorTests.length},
    realModel: api.realModel,
    httpChecks: api.checks.map(check => ({name: check.name, status: check.status})),
    isolation: 'Fresh source copy without .git, installed dependencies, or model caches. External model cache used only with --model.'
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log('Delivery checks passed. Report:', fileURLToPath(output));
} catch (error) {
  await writeFile(output, JSON.stringify({passed: false, realModelRequested: withModel, error: error.message}, null, 2) + '\n');
  throw error;
} finally {
  await rm(scratch, {recursive: true, force: true});
}
