#!/bin/bash
# BB PM API Integration Test Suite
# Run: bash test/api-test.sh

set -e

BASE="http://localhost:3002/api"
PASS=0
FAIL=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red() { printf "\033[31m✗ %s\033[0m\n" "$1"; }

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    green "$desc (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    red "$desc (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_json() {
  local desc="$1" field="$2" expected="$3" body="$4"
  local actual
  actual=$(echo "$body" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);const v=j${field};console.log(v)}catch(e){console.log('PARSE_ERROR')}})")
  if [ "$actual" = "$expected" ]; then
    green "$desc ($field = $actual)"
    PASS=$((PASS + 1))
  else
    red "$desc (expected $field = $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "================================="
echo " BB PM API Integration Tests"
echo "================================="
echo ""

# ─── Health ─────────────────────────
echo "── Health ──"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
assert_status "GET /health" 200 "$STATUS"

# ─── Auth ───────────────────────────
echo ""
echo "── Auth ──"

# Register new user
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@test.com","name":"Test User","password":"password123"}')
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /auth/register" 201 "$STATUS"
assert_json "Register returns token" ".data.accessToken" "$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.accessToken)})")" "$BODY"

# Register duplicate
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@test.com","name":"Dup","password":"password123"}')
assert_status "POST /auth/register (duplicate) → 409" 409 "$STATUS"

# Login
BODY=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@burningb.com","password":"changeme123"}')
TOKEN=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.accessToken)})")
assert_json "Login returns token" ".data.accessToken" "$TOKEN" "$BODY"

# Invalid login
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@burningb.com","password":"wrongpassword"}')
assert_status "POST /auth/login (wrong pwd) → 401" 401 "$STATUS"

# Get profile
BODY=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $TOKEN")
assert_json "GET /auth/me returns email" ".data.email" "admin@burningb.com" "$BODY"

# Unauthorized
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me")
assert_status "GET /auth/me (no token) → 401" 401 "$STATUS"

# ─── Users ──────────────────────────
echo ""
echo "── Users ──"
BODY=$(curl -s "$BASE/users" -H "Authorization: Bearer $TOKEN")
assert_json "GET /users returns success" ".success" "true" "$BODY"

BODY=$(curl -s "$BASE/users?search=admin" -H "Authorization: Bearer $TOKEN")
UCOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.length)})")
assert_status "GET /users?search=admin returns results" 1 "$([[ $UCOUNT -ge 1 ]] && echo 1 || echo 0)"

# ─── Projects ──────────────────────
echo ""
echo "── Projects ──"

# Create project
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Project","key":"TEST","description":"A test project"}')
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /projects" 201 "$STATUS"
PROJECT_ID=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.id)})")
assert_json "Project has key=TEST" ".data.key" "TEST" "$BODY"

# Duplicate key
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Dup","key":"TEST"}')
assert_status "POST /projects (dup key) → 409" 409 "$STATUS"

# List projects
BODY=$(curl -s "$BASE/projects" -H "Authorization: Bearer $TOKEN")
assert_json "GET /projects success" ".success" "true" "$BODY"

# Get single project
BODY=$(curl -s "$BASE/projects/$PROJECT_ID" -H "Authorization: Bearer $TOKEN")
assert_json "GET /projects/:id returns key" ".data.key" "TEST" "$BODY"

# Update project
BODY=$(curl -s -X PATCH "$BASE/projects/$PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated Test Project"}')
assert_json "PATCH /projects/:id updates name" ".data.name" "Updated Test Project" "$BODY"

# ─── Members ───────────────────────
echo ""
echo "── Members ──"

# Get test user ID
TEST_USER_ID=$(curl -s "$BASE/users?search=testuser" -H "Authorization: Bearer $TOKEN" | \
  node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data[0].id)})")

# Add member
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/$PROJECT_ID/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"role\":\"DEVELOPER\"}")
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /members (add)" 201 "$STATUS"
MEMBER_ID=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.id)})")

# List members
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/members" -H "Authorization: Bearer $TOKEN")
MCOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.length)})")
assert_status "GET /members count >= 2" 1 "$([[ $MCOUNT -ge 2 ]] && echo 1 || echo 0)"

# Update member role
BODY=$(curl -s -X PATCH "$BASE/projects/$PROJECT_ID/members/$MEMBER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"PM"}')
assert_json "PATCH /members/:id role=PM" ".data.role" "PM" "$BODY"

# ─── Labels ────────────────────────
echo ""
echo "── Labels ──"

# Seed default labels
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/$PROJECT_ID/labels/seed" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$BODY" | tail -1)
assert_status "POST /labels/seed" 201 "$STATUS"

# List labels
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/labels" -H "Authorization: Bearer $TOKEN")
LCOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.length)})")
assert_status "GET /labels count >= 6" 1 "$([[ $LCOUNT -ge 6 ]] && echo 1 || echo 0)"

# Create label
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/$PROJECT_ID/labels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Custom","color":"#123456"}')
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /labels" 201 "$STATUS"
LABEL_ID=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.id)})")

# Update label
BODY=$(curl -s -X PATCH "$BASE/projects/$PROJECT_ID/labels/$LABEL_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Custom Updated"}')
assert_json "PATCH /labels/:id name" ".data.name" "Custom Updated" "$BODY"

# ─── Issues ────────────────────────
echo ""
echo "── Issues ──"

# Get Bug label for attaching
BUG_LABEL_ID=$(curl -s "$BASE/projects/$PROJECT_ID/labels" -H "Authorization: Bearer $TOKEN" | \
  node -e "process.stdin.on('data',d=>{const ls=JSON.parse(d).data;const b=ls.find(l=>l.name==='Bug');console.log(b?b.id:'')})")

# Create issue
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/projects/$PROJECT_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Test Issue 1\",\"priority\":\"HIGH\",\"type\":\"TASK\",\"labelIds\":[\"$BUG_LABEL_ID\"]}")
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /issues" 201 "$STATUS"
ISSUE_ID=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.id)})")
assert_json "Issue number=1" ".data.number" "1" "$BODY"
assert_json "Issue status=BACKLOG" ".data.status" "BACKLOG" "$BODY"
assert_json "Issue order=1000" ".data.order" "1000" "$BODY"

# Create second issue
BODY=$(curl -s -X POST "$BASE/projects/$PROJECT_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Issue 2","priority":"LOW","type":"BUG"}')
ISSUE2_ID=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.id)})")
assert_json "Issue 2 number=2" ".data.number" "2" "$BODY"
assert_json "Issue 2 order=2000" ".data.order" "2000" "$BODY"

# Create sub-task
BODY=$(curl -s -X POST "$BASE/projects/$PROJECT_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Sub-task of Issue 1\",\"type\":\"SUB_TASK\",\"parentId\":\"$ISSUE_ID\"}")
assert_json "Sub-task parentId set" ".data.parentId" "$ISSUE_ID" "$BODY"

# List issues
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/issues" -H "Authorization: Bearer $TOKEN")
assert_json "GET /issues total >= 3" ".data.total" "3" "$BODY"

# Filter by priority
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/issues?priority=HIGH" -H "Authorization: Bearer $TOKEN")
assert_json "GET /issues?priority=HIGH total=1" ".data.total" "1" "$BODY"

# Search
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/issues?search=Sub-task" -H "Authorization: Bearer $TOKEN")
assert_json "GET /issues?search=Sub-task total=1" ".data.total" "1" "$BODY"

# Board (grouped by status)
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/issues/board" -H "Authorization: Bearer $TOKEN")
BCOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{const b=JSON.parse(d).data;console.log(b.BACKLOG?b.BACKLOG.length:0)})")
assert_status "GET /issues/board BACKLOG count >= 3" 1 "$([[ $BCOUNT -ge 3 ]] && echo 1 || echo 0)"

# Get single issue (with children + activities)
BODY=$(curl -s "$BASE/projects/$PROJECT_ID/issues/$ISSUE_ID" -H "Authorization: Bearer $TOKEN")
assert_json "GET /issues/:id has children" ".data._count.children" "1" "$BODY"

# Update issue (with activity logging)
BODY=$(curl -s -X PATCH "$BASE/projects/$PROJECT_ID/issues/$ISSUE_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"IN_PROGRESS","assigneeId":"'"$TEST_USER_ID"'"}')
assert_json "PATCH /issues/:id status" ".data.status" "IN_PROGRESS" "$BODY"

# Reorder issue (drag to TODO column)
BODY=$(curl -s -X PATCH "$BASE/projects/$PROJECT_ID/issues/$ISSUE2_ID/reorder" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"TODO","order":500}')
assert_json "PATCH /issues/:id/reorder status=TODO" ".data.status" "TODO" "$BODY"
assert_json "PATCH /issues/:id/reorder order=500" ".data.order" "500" "$BODY"

# ─── Activities ────────────────────
echo ""
echo "── Activities ──"

BODY=$(curl -s "$BASE/projects/$PROJECT_ID/issues/$ISSUE_ID/activities" -H "Authorization: Bearer $TOKEN")
ACOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.total)})")
assert_status "GET /issues/:id/activities count >= 2" 1 "$([[ $ACOUNT -ge 2 ]] && echo 1 || echo 0)"

BODY=$(curl -s "$BASE/projects/$PROJECT_ID/activities" -H "Authorization: Bearer $TOKEN")
assert_json "GET /activities success" ".success" "true" "$BODY"

# ─── Dashboard ─────────────────────
echo ""
echo "── Dashboard ──"

BODY=$(curl -s "$BASE/projects/$PROJECT_ID/dashboard" -H "Authorization: Bearer $TOKEN")
assert_json "GET /dashboard totalIssues=3" ".data.totalIssues" "3" "$BODY"
assert_json "GET /dashboard memberCount=2" ".data.memberCount" "2" "$BODY"

# ─── API Keys ──────────────────────
echo ""
echo "── API Keys ──"

BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test AI Key"}')
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /api-keys" 201 "$STATUS"
API_KEY=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.key)})")

# List API keys
BODY=$(curl -s "$BASE/api-keys" -H "Authorization: Bearer $TOKEN")
KCOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.length)})")
assert_status "GET /api-keys count >= 1" 1 "$([[ $KCOUNT -ge 1 ]] && echo 1 || echo 0)"

# ─── External API (API Key Auth) ───
echo ""
echo "── External API ──"

# Create issue via external API
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/external/issues" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"projectKey":"TEST","title":"AI-created issue","priority":"MEDIUM","type":"TASK","assigneeEmail":"admin@burningb.com","labels":["Bug"]}')
STATUS=$(echo "$BODY" | tail -1)
BODY=$(echo "$BODY" | head -1)
assert_status "POST /external/issues" 201 "$STATUS"
assert_json "External issue has project" ".data.project.key" "TEST" "$BODY"
EXT_NUMBER=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.number)})")

# Get issue via external API
BODY=$(curl -s "$BASE/external/issues/TEST/$EXT_NUMBER" -H "X-API-Key: $API_KEY")
assert_json "GET /external/issues/:key/:num title" ".data.title" "AI-created issue" "$BODY"

# Update issue via external API
BODY=$(curl -s -X PATCH "$BASE/external/issues/TEST/$EXT_NUMBER" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"status":"IN_PROGRESS"}')
assert_json "PATCH /external/issues status" ".data.status" "IN_PROGRESS" "$BODY"

# List issues via external API
BODY=$(curl -s "$BASE/external/issues/TEST" -H "X-API-Key: $API_KEY")
ECOUNT=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.length)})")
assert_status "GET /external/issues/:key count >= 4" 1 "$([[ $ECOUNT -ge 4 ]] && echo 1 || echo 0)"

# Filter by status
BODY=$(curl -s "$BASE/external/issues/TEST?status=IN_PROGRESS" -H "X-API-Key: $API_KEY")
ECOUNT2=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.length)})")
assert_status "GET /external/issues?status=IN_PROGRESS count >= 2" 1 "$([[ $ECOUNT2 -ge 2 ]] && echo 1 || echo 0)"

# Invalid API key
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/external/issues/TEST" -H "X-API-Key: invalid_key")
assert_status "External API (invalid key) → 401" 401 "$STATUS"

# ─── Cleanup (delete issue) ────────
echo ""
echo "── Cleanup ──"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/projects/$PROJECT_ID/issues/$ISSUE2_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_status "DELETE /issues/:id" 200 "$STATUS"

# Remove member
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/projects/$PROJECT_ID/members/$MEMBER_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_status "DELETE /members/:id" 200 "$STATUS"

# ─── Summary ───────────────────────
echo ""
echo "================================="
echo " Results: $PASS passed, $FAIL failed"
echo "================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
