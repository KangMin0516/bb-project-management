/**
 * Seed script: Create PITB project and import all FRS/planning documents as specifications.
 *
 * Usage:
 *   cd packages/api && npx ts-node -r tsconfig-paths/register ../../scripts/seed-pitb-specs.ts
 *
 * Prerequisites: DB running, backend compiled or ts-node available.
 */

import * as fs from 'fs'
import * as path from 'path'

const API_BASE = 'http://localhost:3002/api'
const DOCS_DIR = '/Users/seonguk/Develop/playinthebox/docs'

const ADMIN_EMAIL = 'admin@burningb.com'
const ADMIN_PASSWORD = 'changeme123'

interface Spec {
  filename: string
  title: string
  category: string
  order: number
}

function categorize(filename: string): { title: string; category: string } {
  const name = filename.replace('.md', '')

  // Flow documents
  if (name.includes('FLOW_')) {
    const match = name.match(/FLOW_([A-Z])_(.+)/)
    if (match) return { title: `Flow ${match[1]}: ${match[2].replace(/_/g, ' ')}`, category: 'Flow' }
  }

  // FRS documents
  if (name.includes('FRS_')) {
    if (name.includes('작성원칙')) return { title: 'FRS 작성원칙', category: 'FRS' }
    const match = name.match(/FRS_([A-Z]\d?)_(.+)/)
    if (match) return { title: `FRS ${match[1]}: ${match[2].replace(/_/g, ' ')}`, category: 'FRS' }
    // FRS with sub-number like G2b
    const match2 = name.match(/FRS_([A-Z]\d+[a-z]?)_(.+)/)
    if (match2) return { title: `FRS ${match2[1]}: ${match2[2].replace(/_/g, ' ')}`, category: 'FRS' }
  }

  // Design/Benchmark
  if (name.includes('디자인') || name.includes('KREAM') || name.includes('POPMART') || name.includes('DHUMAN') || name.includes('벤치마킹')) {
    return { title: name.replace(/^\d+_/, '').replace(/_/g, ' '), category: '디자인/벤치마킹' }
  }

  // Planning/Overview
  if (name.includes('프로젝트_개요') || name.includes('기획') || name.includes('타임라인') || name.includes('종합검토')) {
    return { title: name.replace(/^\d+_/, '').replace(/_/g, ' '), category: '기획' }
  }

  // Commerce
  if (name.includes('커머스')) {
    return { title: name.replace(/^\d+_/, '').replace(/_/g, ' '), category: '커머스' }
  }

  // System design
  if (name.includes('포인트') || name.includes('POS') || name.includes('스토어') || name.includes('알림')) {
    return { title: name.replace(/^\d+_/, '').replace(/_/g, ' '), category: '시스템설계' }
  }

  // Legal/decisions
  if (name.includes('법률') || name.includes('미결사항')) {
    return { title: name.replace(/^\d+_/, '').replace(/_/g, ' '), category: '의사결정' }
  }

  // Default
  return { title: name.replace(/^\d+_/, '').replace(/_/g, ' '), category: '기타' }
}

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const data: any = await res.json()
  return data.data?.accessToken ?? data.accessToken
}

async function createProject(token: string): Promise<string> {
  // Check if PITB project already exists
  const listRes = await fetch(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listBody: any = await listRes.json()
  const projects = listBody.data ?? listBody
  const existing = (Array.isArray(projects) ? projects : []).find((p: any) => p.key === 'PITB')
  if (existing) {
    console.log(`Project PITB already exists (${existing.id})`)
    return existing.id
  }

  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Play in the Box',
      key: 'PITB',
      description: '플레이인더박스 오프라인 매장 + 온라인 커머스 통합 플랫폼',
    }),
  })
  if (!res.ok) throw new Error(`Create project failed: ${res.status} ${await res.text()}`)
  const resBody: any = await res.json()
  const project = resBody.data ?? resBody
  console.log(`Created project: ${project.name} (${project.id})`)
  return project.id
}

async function createSpec(
  token: string,
  projectId: string,
  spec: Spec,
): Promise<void> {
  const filePath = path.join(DOCS_DIR, spec.filename)
  const content = fs.readFileSync(filePath, 'utf-8')

  const res = await fetch(`${API_BASE}/projects/${projectId}/specifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: spec.title,
      content,
      category: spec.category,
      status: 'APPROVED',
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error(`  FAILED: ${spec.title} - ${res.status} ${errText}`)
    return
  }
  console.log(`  ✓ ${spec.title} [${spec.category}]`)
}

async function main() {
  console.log('=== PITB Specification Import ===\n')

  // Read all markdown files
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md')).sort()

  // Build spec list with categories
  const specs: Spec[] = files.map((filename, idx) => {
    const { title, category } = categorize(filename)
    return { filename, title, category, order: idx + 1 }
  })

  console.log(`Found ${specs.length} documents to import:\n`)
  const categoryCount = new Map<string, number>()
  for (const s of specs) {
    categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1)
  }
  for (const [cat, count] of categoryCount) {
    console.log(`  ${cat}: ${count}`)
  }
  console.log('')

  // Login
  const token = await login()
  console.log('Logged in as admin\n')

  // Create project
  const projectId = await createProject(token)
  console.log('')

  // Import specs
  console.log('Importing specifications...\n')
  for (const spec of specs) {
    await createSpec(token, projectId, spec)
  }

  console.log('\n=== Done! ===')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
