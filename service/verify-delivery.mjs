import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const withModel = process.argv.includes('--model');
const refIndex = process.argv.indexOf('--ref');
const sourceRef = refIndex >= 0 ? process.argv[refIndex + 1] : null;
if (refIndex >= 0) assert.ok(sourceRef, '--ref requires a commit or ref.');
const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8', maxBuffer:16*1024*1024});
const sourceCommit = git(['rev-parse','--verify',(sourceRef || 'HEAD')+'^{commit}']).trim();
const workspaceStatus = git(['status','--porcelain=v1','--untracked-files=all']);
const workspacePatch = sourceRef ? '' : git(['diff','--binary','HEAD']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
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

async function artifact(path) {
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path)) hash.update(chunk);
  return {bytes:(await stat(path)).size,sha256:hash.digest('hex')};
}

try {
  const filenames = sourceRef
    ? git(['ls-tree','-r','--name-only','-z',sourceCommit]).split('\0').filter(Boolean)
    : git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
  const sourceFiles = {};
  for (const filename of [...new Set(filenames)].sort()) {
    const target = join(checkout, filename);
    await mkdir(dirname(target), {recursive:true});
    if (sourceRef) {
      const bytes = execFileSync('git',['show',sourceCommit+':'+filename],{cwd:root,maxBuffer:16*1024*1024});
      await writeFile(target,bytes);
    } else {
      try { await copyFile(join(root, filename), target); }
      catch (error) { if(error.code==='ENOENT') continue; throw error; }
    }
    if (/\.(?:mjs|py|html|css)$/.test(filename) || filename==='package.json') {
      sourceFiles[filename] = digest(await readFile(target));
    }
  }
  const sourceIdentity = {
    mode:sourceRef ? 'commit' : 'workspace',
    commit:sourceCommit,
    dirty:sourceRef ? false : Boolean(workspaceStatus.trim()),
    workspaceStatus:sourceRef ? '' : workspaceStatus,
    trackedPatchSha256:digest(workspacePatch),
    files:sourceFiles,
    sourceDigest:digest(JSON.stringify(sourceFiles))
  };
  await writeFile(new URL('./validation/delivery-source.patch',import.meta.url),workspacePatch);

  run(['--test', 'retrieval/regression.test.mjs', 'generation/citations.test.mjs', 'temporal/dates.test.mjs', 'retrieval/review.test.mjs']);
  run(['--test','generation/notice.test.mjs','web/notices.test.mjs']);
  run(['--test','qa/campus.test.mjs']);
  run(['--test','qa/integration.test.mjs','generation/intake-regression.test.mjs','experiments/worlds.test.mjs','experiments/score.test.mjs','service/static-imports.test.mjs']);
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
  await copyFile(join(checkout,'service/validation/campus-examples.json'),new URL('./validation/campus-examples.json',import.meta.url));
  const modelArtifacts=withModel ? {
    weights:await artifact(join(process.env.NOWPAST_MODEL_HOME,'model.gguf'))
  } : null;
  if(withModel) {
    const runtime=join(process.env.NOWPAST_MODEL_HOME,'b12559');
    const filename=process.platform==='win32'?'llama-server.exe':'llama-server';
    const executable=(await readdir(runtime,{recursive:true})).find(path=>path.split(/[\\/]/).at(-1)===filename);
    assert.ok(executable,'Missing inference executable.');
    modelArtifacts.runtime=await artifact(join(runtime,executable));
  }
  const validationInputs = {};
  for (const filename of ['service/verify-delivery.mjs', 'service/verify-service.mjs', 'retrieval/regression.test.mjs', 'generation/citations.test.mjs', 'temporal/dates.test.mjs']) {
    validationInputs[filename] = createHash('sha256').update(await readFile(join(checkout, filename))).digest('hex');
  }
  const report = {
    passed: true,
    sourceCommit,
    source:sourceIdentity,
    command:[process.execPath,...process.argv.slice(1)],
    apiResults:api,
    modelArtifacts,
    inputs: results.inputs,
    validationInputs,
    environment: {node: process.version, platform: process.platform, arch: process.arch},
    currentEvidence: {passed: results.rows.length, total: results.rows.length},
    evidenceRoles: {passed: results.rows.filter(row => row.gnp).length, total: results.rows.filter(row => row.gnp).length},
    researchSources: {passed: results.researchRows.length, total: results.researchRows.length},
    behavior: {passed: results.behaviorTests.length, total: results.behaviorTests.length},
    campusDevelopment:{testFile:'qa/campus.test.mjs',passed:true,separateFromFrozenEvaluation:true},
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
  assert.equal(dirname(scratch),tmpdir(), 'Temporary checkout must remain inside the selected temp directory.');
  assert.ok(scratch.startsWith(join(tmpdir(),'nowpast-delivery-')), 'Unexpected temporary checkout path.');
  await rm(scratch, {recursive: true, force: true});
}
