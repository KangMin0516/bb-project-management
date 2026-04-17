/**
 * DC Migration Phase 2: Create users (Slack email) + approve + assign DC issues
 *
 * Usage: npx tsx scripts/migrate-users-dc.ts
 */

const API = 'http://localhost:3002/api';
let token = '';

// ─── Users from Slack ──────────────────────────────────────
const USERS_TO_CREATE = [
  { email: 'nguyentrongphu143@gmail.com', name: 'Phú nguyễn' },
  { email: 'thevalkdokk@gmail.com', name: 'Chánh Đức' },
  { email: 'ptung230801@gmail.com', name: 'Phạm Tùng' },
  { email: 'vanthuong.dao2004@gmail.com', name: 'Văn Thương Đào' },
  { email: 'quocbao25098@gmail.com', name: 'Bao Quoc' },
  { email: 'vanlong20it@gmail.com', name: 'Long Nguyen' },
  { email: 'minhthunguyen.bu@gmail.com', name: 'Thu' },
  { email: 'hieutran4896@gmail.com', name: 'Minh Hiếu Trần' },
];

const DEFAULT_PASSWORD = 'burningbros2026';

// ─── DC issue → assignee email ─────────────────────────────
const DC_ASSIGNEES: Record<string, string> = {
  'DC-2': 'nguyentrongphu143@gmail.com',
  'DC-3': 'nguyentrongphu143@gmail.com',
  'DC-4': 'su.seo@burningb.com',
  'DC-12': 'nguyentrongphu143@gmail.com',
  'DC-13': 'nguyentrongphu143@gmail.com',
  'DC-14': 'nguyentrongphu143@gmail.com',
  'DC-15': 'nguyentrongphu143@gmail.com',
  'DC-16': 'nguyentrongphu143@gmail.com',
  'DC-17': 'nguyentrongphu143@gmail.com',
  'DC-18': 'nguyentrongphu143@gmail.com',
  'DC-19': 'nguyentrongphu143@gmail.com',
};

// ─── API helpers ──────────────────────────────────────────
async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

async function main() {
  console.log('=== Phase 2: Users + Assignee Mapping ===\n');

  // 1. Login as admin
  console.log('1. Login...');
  const loginData = await api('POST', '/auth/login', { email: 'admin@burningb.com', password: 'changeme123' });
  token = loginData.accessToken;
  console.log('  ✓ OK\n');

  // 2. Register users
  console.log('2. Register users...');
  for (const u of USERS_TO_CREATE) {
    try {
      await api('POST', '/auth/register', { email: u.email, name: u.name, password: DEFAULT_PASSWORD });
      console.log(`  ✓ ${u.name} (${u.email})`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already')) {
        console.log(`  · Exists: ${u.name}`);
      } else {
        console.error(`  ✗ ${u.name}: ${e.message}`);
      }
    }
  }

  // 3. Approve pending users
  console.log('\n3. Approve pending users...');
  const pending = await api('GET', '/users/pending');
  for (const u of pending) {
    try {
      await api('PATCH', `/users/${u.id}/approve`);
      console.log(`  ✓ Approved: ${u.name} (${u.email})`);
    } catch (e: any) {
      console.error(`  ✗ ${u.name}: ${e.message}`);
    }
  }
  if (pending.length === 0) console.log('  · No pending users');

  // 4. Build email → userId map
  console.log('\n4. Build user map...');
  const allUsers = await api('GET', '/users');
  const emailToId: Record<string, string> = {};
  for (const u of allUsers) {
    emailToId[u.email] = u.id;
  }
  console.log(`  ✓ ${Object.keys(emailToId).length} users`);

  // 5. Find DC project
  console.log('\n5. Find DC project...');
  const projects = await api('GET', '/projects');
  const dc = projects.find((p: any) => p.key === 'DC');
  if (!dc) { console.error('  ✗ DC not found'); return; }
  console.log(`  ✓ ${dc.id}`);

  // 6. Add members to DC
  console.log('\n6. Add members to DC...');
  const memberEmails = [...new Set(Object.values(DC_ASSIGNEES))];
  for (const email of memberEmails) {
    const userId = emailToId[email];
    if (!userId) { console.log(`  · Skip: ${email} (not in DB)`); continue; }
    try {
      await api('POST', `/projects/${dc.id}/members`, { userId, role: 'DEVELOPER' });
      console.log(`  ✓ ${email}`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already') || e.message.includes('Already')) {
        console.log(`  · Already: ${email}`);
      } else {
        console.error(`  ✗ ${email}: ${e.message}`);
      }
    }
  }

  // 7. Assign issues
  console.log('\n7. Assign DC issues...');
  const issueData = await api('GET', `/projects/${dc.id}/issues?limit=100`);
  const issues = issueData.items || issueData;
  let mapped = 0;
  for (const issue of issues) {
    const match = issue.title.match(/^\[(DC-\d+)\]/);
    if (!match) continue;
    const jiraKey = match[1];
    const email = DC_ASSIGNEES[jiraKey];
    if (!email) continue;
    const userId = emailToId[email];
    if (!userId || issue.assigneeId === userId) continue;

    try {
      await api('PATCH', `/projects/${dc.id}/issues/${issue.id}`, { assigneeId: userId });
      console.log(`  ✓ ${jiraKey} → ${email}`);
      mapped++;
    } catch (e: any) {
      console.error(`  ✗ ${jiraKey}: ${e.message}`);
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Users created: ${USERS_TO_CREATE.length}`);
  console.log(`Issues assigned: ${mapped}`);
  console.log(`Default password: ${DEFAULT_PASSWORD}`);
  console.log(`→ 유저들에게 비밀번호 변경 안내 필요`);
}

main().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
