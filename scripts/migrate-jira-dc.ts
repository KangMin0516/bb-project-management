/**
 * DABI-CHAT (DC) Jira → BB PM Migration Script
 *
 * Usage:
 *   npx tsx scripts/migrate-jira-dc.ts
 *
 * Prerequisites:
 *   - BB PM API running at http://localhost:3002/api
 *   - Admin account: admin@burningb.com / changeme123
 */

const API = 'http://localhost:3002/api';

// ─── Jira DC Issues (extracted from Jira API) ──────────────────
const DC_ISSUES = [
  {
    key: 'DC-1',
    type: 'Task',
    summary: '[Feature] Add Monthly Statistics to Existing Daily-based Statistics',
    description: '**Context**\n\n* Add monthly view option in statistics screen\n* Display monthly trends and comparisons\n* Allow switching between daily/monthly views\n\n**To-do**\n\n* Add toggle/tab for Daily vs Monthly view\n* Update API endpoints for monthly data\n* Update charts/graphs for monthly display\n* Add month picker component',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: '',
  },
  {
    key: 'DC-2',
    type: 'Task',
    summary: 'Create Performance analysis tab',
    description: 'New dashboard menu (Performance analysis)\n\n* GET /api/daily-report/get_customer_analysis/?date_from=2024-01-01&date_to=2024-01-31\n* GET /api/daily-report/get_staff_analysis/?date_from=2024-01-01&date_to=2024-01-31',
    status: 'Done',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: '',
  },
  {
    key: 'DC-3',
    type: 'Task',
    summary: 'Two things need to be checked.',
    description: 'We updated dashboard page, but somehow we removed hour based graph under daily report. Please check and roll it back.\n\nSeems API is a bit slow on handling long term data. Give me exact slow apis. So that we could optimize those.',
    status: 'Done',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: '',
  },
  {
    key: 'DC-4',
    type: 'Task',
    summary: '고객 분석 페이지 추가',
    description: '',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'seo seonguk',
    parentKey: '',
  },
  {
    key: 'DC-5',
    type: 'Epic',
    summary: 'POS Tablet App Development for Offline Store Order Management',
    description: '## Overview\n\nDevelop a POS tablet app for 3 offline stores (EYEIYAGI BINHTHANH, GOVAP, LEVANSY).\n\n## Features\n\n1. Store-based staff login\n2. Product browsing & cart\n3. Phone-based customer search/create (mandatory)\n4. Order creation (Cash/Bank transfer)\n5. Order history\n6. Store-based order management',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: '',
  },
  {
    key: 'DC-6',
    type: 'Task',
    summary: '[BE] Create Store Model & Migration',
    description: 'Create Store model with fields: id, name, code, address, phone, isActive, createdAt, updatedAt.\nCreate migration and seed 3 stores.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-7',
    type: 'Task',
    summary: '[BE] POS Auth - OAuth2 + Store Context',
    description: 'Implement POS login with store context. Staff selects store at login. Token includes storeId.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-8',
    type: 'Task',
    summary: '[BE] POS Product List API',
    description: 'GET /pos/products - List products for POS with category filter, search, pagination.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-9',
    type: 'Task',
    summary: '[BE] POS Customer Search & Create API',
    description: 'POST /pos/customers/search - Search by phone number.\nPOST /pos/customers - Create new customer with phone, name.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-10',
    type: 'Task',
    summary: '[BE] POS Order Creation API',
    description: 'POST /pos/orders - Create POS order with items, customer, payment method (cash/bank), store context.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-11',
    type: 'Task',
    summary: '[FE] POS Wireframe Setup & Vercel Deployment',
    description: 'Setup Next.js project for POS wireframe. Deploy to Vercel. Create basic layout and routing.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-12',
    type: 'Task',
    summary: '[Mobile] Flutter Project Setup & Architecture',
    description: 'Initialize Flutter project with clean architecture. Setup state management, routing, DI.',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-13',
    type: 'Task',
    summary: '[Mobile] POS Login Screen',
    description: 'Login screen with store selection dropdown + staff credentials. OAuth2 password flow.',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-14',
    type: 'Task',
    summary: '[Mobile] POS Main Screen - Product Grid & Cart',
    description: 'Main POS screen: product grid with category tabs, search, cart panel with quantity controls.',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-15',
    type: 'Task',
    summary: '[Mobile] POS Customer Search & Create',
    description: 'Customer search by phone. Create new customer if not found. Link customer to order (mandatory).',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-16',
    type: 'Task',
    summary: '[Mobile] POS Order Confirm & Payment Screen',
    description: 'Order confirmation: item list, total, customer info. Payment method selection (Cash/Bank transfer).',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-17',
    type: 'Task',
    summary: '[Mobile] POS Receipt & Order Complete Screen',
    description: 'Receipt screen after order creation. Show order number, items, total, payment method.',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-18',
    type: 'Task',
    summary: '[Mobile] POS Order History Screen',
    description: 'Order history list with date filter, status filter, search. Order detail view.',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-19',
    type: 'Task',
    summary: '[FE/Mobile] Lens Power (L/R) Dropdown Selection on Product Add',
    description: 'Add lens power dropdown (L/R) when adding contact lens products to cart.',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'Phú nguyễn',
    parentKey: 'DC-5',
  },
  {
    key: 'DC-20',
    type: 'Task',
    summary: '[FE] Update Wireframe with Real Product Catalog & Images',
    description: 'Replace placeholder data in POS wireframe with real product catalog data and images.',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    parentKey: 'DC-5',
  },
];

// ─── Mapping ──────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  'To Do': 'TODO',
  'In Progress': 'IN_PROGRESS',
  'Ready to Test': 'REVIEW_QA',
  'READY TO TEST': 'REVIEW_QA',
  'VERIFY': 'REVIEW_QA',
  'Done': 'DONE',
};

const TYPE_MAP: Record<string, string> = {
  'Epic': 'EPIC',
  'Task': 'TASK',
  'Bug': 'BUG',
  'Sub-task': 'SUB_TASK',
};

// ─── API helpers ──────────────────────────────────────────────
let token = '';

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
  // API wraps responses in { success, data }
  return json.data !== undefined ? json.data : json;
}

async function login(email: string, password: string) {
  const data = await api('POST', '/auth/login', { email, password });
  token = data.accessToken;
  return data;
}

async function registerUser(email: string, name: string, password: string) {
  try {
    await api('POST', '/auth/register', { email, name, password });
    console.log(`  ✓ Registered: ${name} (${email})`);
  } catch (e: any) {
    if (e.message.includes('409') || e.message.includes('Conflict')) {
      console.log(`  · Already exists: ${name} (${email})`);
    } else {
      throw e;
    }
  }
}

async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const data = await api('GET', `/users?email=${encodeURIComponent(email)}`);
    return data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('=== DABI-CHAT (DC) → BB PM Migration ===\n');

  // 1. Login as admin
  console.log('1. Logging in as admin...');
  await login('admin@burningb.com', 'changeme123');
  console.log('  ✓ Logged in\n');

  // 2. Create project
  console.log('2. Creating DABI-CHAT project...');
  let project: any;
  try {
    project = await api('POST', '/projects', {
      name: 'DABI-CHAT',
      key: 'DC',
      description: 'DABI-CHAT e-commerce platform - Migrated from Jira',
    });
    console.log(`  ✓ Created project: ${project.key} (${project.id})\n`);
  } catch (e: any) {
    if (e.message.includes('409') || e.message.includes('Conflict') || e.message.includes('already')) {
      console.log('  · Project DC may already exist, fetching...');
      const projects = await api('GET', '/projects');
      project = projects.find((p: any) => p.key === 'DC');
      if (!project) throw new Error('Could not find or create DC project');
      console.log(`  ✓ Found existing: ${project.key} (${project.id})\n`);
    } else {
      throw e;
    }
  }

  // 3. Create issues (two passes: first non-children, then children for parent linking)
  console.log('3. Creating issues...');
  const keyToId: Record<string, string> = {};

  // Pass 1: Issues without parent (or parent=DC-5 which is an Epic)
  const epicsAndRoots = DC_ISSUES.filter((i) => !i.parentKey);
  const children = DC_ISSUES.filter((i) => i.parentKey);

  for (const issue of epicsAndRoots) {
    try {
      const created = await api('POST', `/projects/${project.id}/issues`, {
        title: `[${issue.key}] ${issue.summary}`,
        description: issue.description || undefined,
        status: STATUS_MAP[issue.status] || 'TODO',
        priority: (issue.priority || 'MEDIUM').toUpperCase(),
        type: TYPE_MAP[issue.type] || 'TASK',
      });
      keyToId[issue.key] = created.id;
      console.log(`  ✓ ${issue.key}: ${issue.summary.substring(0, 50)}...`);
    } catch (e: any) {
      console.error(`  ✗ ${issue.key}: ${e.message}`);
    }
  }

  // Pass 2: Child issues (link to parent)
  for (const issue of children) {
    const parentId = keyToId[issue.parentKey];
    try {
      const created = await api('POST', `/projects/${project.id}/issues`, {
        title: `[${issue.key}] ${issue.summary}`,
        description: issue.description || undefined,
        status: STATUS_MAP[issue.status] || 'TODO',
        priority: (issue.priority || 'MEDIUM').toUpperCase(),
        type: 'SUB_TASK',
        parentId: parentId || undefined,
      });
      keyToId[issue.key] = created.id;
      console.log(`  ✓ ${issue.key}: ${issue.summary.substring(0, 50)}... (→ ${issue.parentKey})`);
    } catch (e: any) {
      console.error(`  ✗ ${issue.key}: ${e.message}`);
    }
  }

  console.log(`\n  Total: ${Object.keys(keyToId).length}/${DC_ISSUES.length} issues created\n`);

  // 4. Summary
  console.log('=== Migration Complete ===');
  console.log(`Project: ${project.key} (${project.id})`);
  console.log(`Issues migrated: ${Object.keys(keyToId).length}`);
  console.log('\n⚠️  Assignee mapping was skipped (see questions below)');
  console.log('\n--- Questions for user ---');
  console.log('Q1. Phú nguyễn의 BB PM 계정을 만들까요? (이메일 필요)');
  console.log('Q2. 이슈 assignee를 자동 매핑할까요?');
  console.log('Q3. Done 상태 이슈(DC-2, DC-3)도 이전할까요? (현재 포함됨)');
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
