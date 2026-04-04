#!/usr/bin/env node
/**
 * Delete older Vercel deployments for one project, keeping the 10 most recent.
 *
 * Setup:
 *   1. Vercel → Account Settings → Tokens → create token
 *   2. Project → Settings → General → copy Project ID
 *   3. If team scope: Settings → copy Team ID (optional VERCEL_TEAM_ID)
 *
 * Dry run (default — only prints what would happen):
 *   VERCEL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/prune-vercel-deployments.mjs
 *
 * Actually delete:
 *   VERCEL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/prune-vercel-deployments.mjs --execute
 */

const KEEP = 10;
const BASE = 'https://api.vercel.com';

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID || '';

if (!token || !projectId) {
  console.error('Required env: VERCEL_TOKEN, VERCEL_PROJECT_ID (optional: VERCEL_TEAM_ID)');
  process.exit(1);
}

const execute = process.argv.includes('--execute');

async function fetchPage(until) {
  const u = new URL(`${BASE}/v6/deployments`);
  u.searchParams.set('projectId', projectId);
  u.searchParams.set('limit', '100');
  if (teamId) u.searchParams.set('teamId', teamId);
  if (until != null) u.searchParams.set('until', String(until));
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`List deployments ${r.status}: ${t}`);
  }
  return r.json();
}

async function fetchAllDeployments() {
  const all = [];
  let until = undefined;
  for (let page = 0; page < 500; page++) {
    const j = await fetchPage(until);
    const batch = j.deployments || [];
    all.push(...batch);
    const next = j.pagination?.next;
    if (next == null || batch.length === 0) break;
    until = next;
  }
  return all;
}

function deleteUrl(uid) {
  const u = new URL(`${BASE}/v13/deployments/${uid}`);
  if (teamId) u.searchParams.set('teamId', teamId);
  return u.toString();
}

async function deleteDeployment(uid) {
  const r = await fetch(deleteUrl(uid), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, body: t };
  }
  return { ok: true };
}

async function main() {
  console.log(`Project ${projectId} — fetching deployments…`);
  const deployments = await fetchAllDeployments();
  const createdMs = (c) => {
    if (c == null || c === 0) return 0;
    return c > 1e12 ? c : c * 1000;
  };
  deployments.sort((a, b) => createdMs(b.created) - createdMs(a.created));
  const toDelete = deployments.slice(KEEP);

  console.log(`Found ${deployments.length} deployment(s). Keeping newest ${KEEP}, removing ${toDelete.length}.`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  if (!execute) {
    console.log('\nDry run only. To delete, run again with --execute\n');
    toDelete.slice(0, 15).forEach((d) => {
      console.log(`  ${d.uid}  ${new Date(createdMs(d.created)).toISOString()}  ${d.url || ''}`);
    });
    if (toDelete.length > 15) console.log(`  … and ${toDelete.length - 15} more`);
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const d of toDelete) {
    const res = await deleteDeployment(d.uid);
    if (res.ok) {
      ok++;
      process.stdout.write('.');
    } else {
      fail++;
      console.error(`\nFailed ${d.uid} (${res.status}): ${res.body?.slice(0, 200)}`);
    }
  }
  console.log(`\nDone. Deleted ${ok}, failed ${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
