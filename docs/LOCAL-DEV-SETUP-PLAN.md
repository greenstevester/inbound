# Local Development Setup Plan: Inbound + Pet Panic Button

## Overview

This plan details how to set up Inbound locally for development and integrate it with thepetpanicbutton project for automated email responses using Qwen2.5-7B-Instruct via Ollama.

---

## System Architecture (Target State)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL DEVELOPMENT ENVIRONMENT                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                           INBOUND (localhost:3000)                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │  Dashboard  │  │  Elysia API │  │  Webhook    │  │  Better Auth        │ │ │
│  │  │  (Next.js)  │  │  /api/e2/*  │  │  Receiver   │  │  (API Keys)         │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  │         │                │                │                    │             │ │
│  │         └────────────────┴────────────────┴────────────────────┘             │ │
│  │                                    │                                          │ │
│  │                                    ▼                                          │ │
│  │                         ┌───────────────────┐                                │ │
│  │                         │     PostgreSQL    │                                │ │
│  │                         │  (Docker :5432)   │                                │ │
│  │                         │                   │                                │ │
│  │                         │ • structured_emails│                               │ │
│  │                         │ • sent_emails      │                               │ │
│  │                         │ • domains          │                               │ │
│  │                         │ • email_addresses  │                               │ │
│  │                         │ • api_keys         │                               │ │
│  │                         └───────────────────┘                                │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                        ▲                                          │
│                                        │ Poll for new emails                      │
│                                        │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                     PET PANIC BUTTON REPLY WORKER                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐│ │
│  │  │  1. Poll structured_emails for new rows                                  ││ │
│  │  │  2. Fetch email content                                                  ││ │
│  │  │  3. Classify email type (waitlist, support, partnership, etc.)          ││ │
│  │  │  4. Generate response via Ollama                                         ││ │
│  │  │  5. Queue for human review OR auto-send (waitlist only)                 ││ │
│  │  │  6. Send via Inbound API                                                 ││ │
│  │  └─────────────────────────────────────────────────────────────────────────┘│ │
│  │                              │                                               │ │
│  │                              ▼                                               │ │
│  │                   ┌───────────────────┐                                      │ │
│  │                   │      Ollama       │                                      │ │
│  │                   │   localhost:11434 │                                      │ │
│  │                   │                   │                                      │ │
│  │                   │ qwen2.5-instruct  │                                      │ │
│  │                   │       :7b         │                                      │ │
│  │                   └───────────────────┘                                      │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Prerequisites & Environment Setup

### Duration: ~30 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: PREREQUISITES                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1.1: Verify Tools Installed                               │
│  ─────────────────────────────────                              │
│  [ ] Bun 1.1+          → bun --version                          │
│  [ ] Docker            → docker --version                       │
│  [ ] Ollama            → ollama --version                       │
│  [ ] Git               → git --version                          │
│                                                                  │
│  Step 1.2: Pull LLM Model                                       │
│  ────────────────────────                                       │
│  [ ] Run: ollama pull qwen2.5-instruct:7b                       │
│  [ ] Verify: ollama list (should show qwen2.5-instruct:7b)      │
│  [ ] Test: ollama run qwen2.5-instruct:7b "Hello"               │
│                                                                  │
│  Step 1.3: Clone/Verify Repositories                            │
│  ───────────────────────────────────                            │
│  [ ] Inbound:                                                    │
│      ~/dev/git-repos/github/techno-8/inbound                    │
│  [ ] Pet Panic Button:                                           │
│      ~/dev/git-repos/github/bayvets/thepetpanicbutton           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Database Setup

### Duration: ~15 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: DATABASE SETUP                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  OPTION A: Local Docker PostgreSQL (Recommended for dev)    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                              ││
│  │  Step 2.1a: Start PostgreSQL Container                       ││
│  │  ─────────────────────────────────                          ││
│  │  [ ] Run:                                                    ││
│  │      docker run -d --name inbound-postgres \                 ││
│  │        -e POSTGRES_USER=inbound \                            ││
│  │        -e POSTGRES_PASSWORD=inbound \                        ││
│  │        -e POSTGRES_DB=inbound \                              ││
│  │        -p 5432:5432 \                                        ││
│  │        postgres:16                                           ││
│  │                                                              ││
│  │  Step 2.2a: Verify Container Running                         ││
│  │  ───────────────────────────────                            ││
│  │  [ ] Run: docker ps                                          ││
│  │  [ ] Should see: inbound-postgres ... Up                     ││
│  │                                                              ││
│  │  Step 2.3a: Test Connection                                  ││
│  │  ──────────────────────                                     ││
│  │  [ ] Run: docker exec -it inbound-postgres psql \            ││
│  │           -U inbound -d inbound -c "SELECT 1;"               ││
│  │                                                              ││
│  │  Connection String:                                          ││
│  │  postgres://inbound:inbound@localhost:5432/inbound           ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  OPTION B: Neon Development Branch (Cloud)                  ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                              ││
│  │  Step 2.1b: Reset Development Branch                         ││
│  │  ────────────────────────────────                           ││
│  │  [ ] Run: bun run neon:reset                                 ││
│  │                                                              ││
│  │  Step 2.2b: Get Connection String                            ││
│  │  ────────────────────────────                               ││
│  │  [ ] Copy from Neon dashboard (development branch)           ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Environment Configuration

### Duration: ~20 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: ENVIRONMENT CONFIGURATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 3.1: Create .env File                                     │
│  ──────────────────────────                                     │
│  [ ] Copy template (if exists):                                  │
│      cp .env.example .env                                        │
│  [ ] OR create new .env file                                     │
│                                                                  │
│  Step 3.2: Configure Required Variables                         │
│  ──────────────────────────────────────                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  # ========== DATABASE ==========                            ││
│  │  DATABASE_URL=postgres://inbound:inbound@localhost:5432/     ││
│  │               inbound                                        ││
│  │                                                              ││
│  │  # ========== AUTHENTICATION ==========                      ││
│  │  BETTER_AUTH_SECRET=generate-32-char-random-string           ││
│  │  BETTER_AUTH_URL=http://localhost:3000                       ││
│  │                                                              ││
│  │  # ========== LOCAL DEV OVERRIDES ==========                 ││
│  │  ALLOW_REQUESTS_WITHOUT_RATE_LIMIT=true                      ││
│  │  NODE_ENV=development                                        ││
│  │                                                              ││
│  │  # ========== SERVICE API KEY ==========                     ││
│  │  # Used by webhook and external services                     ││
│  │  SERVICE_API_KEY=dev-service-key-change-in-prod              ││
│  │                                                              ││
│  │  # ========== OPTIONAL: Skip for local dev ==========        ││
│  │  # UPSTASH_REDIS_REST_URL=                                   ││
│  │  # UPSTASH_REDIS_REST_TOKEN=                                 ││
│  │  # AWS_ACCESS_KEY_ID=                                        ││
│  │  # AWS_SECRET_ACCESS_KEY=                                    ││
│  │  # AWS_REGION=                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 3.3: Generate Auth Secret                                 │
│  ──────────────────────────────                                 │
│  [ ] Run: openssl rand -hex 32                                   │
│  [ ] Copy output to BETTER_AUTH_SECRET                           │
│                                                                  │
│  Step 3.4: Verify .env is Gitignored                            │
│  ───────────────────────────────────                            │
│  [ ] Check: grep ".env" .gitignore                               │
│  [ ] Should show .env is ignored                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Database Schema & Migrations

### Duration: ~10 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: DATABASE SCHEMA SETUP                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 4.1: Install Dependencies                                 │
│  ──────────────────────────────                                 │
│  [ ] Run: bun install                                            │
│                                                                  │
│  Step 4.2: Push Schema to Database                              │
│  ─────────────────────────────────                              │
│  [ ] Run: bunx drizzle-kit push                                  │
│                                                                  │
│  Expected Output:                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [✓] Changes applied                                         ││
│  │                                                              ││
│  │  Tables created:                                             ││
│  │  • user                                                      ││
│  │  • session                                                   ││
│  │  • account                                                   ││
│  │  • api_key                                                   ││
│  │  • organization                                              ││
│  │  • domains                                                   ││
│  │  • email_addresses                                           ││
│  │  • structured_emails                                         ││
│  │  • sent_emails                                               ││
│  │  • endpoints                                                 ││
│  │  • ... (other tables)                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 4.3: Verify Tables Created                                │
│  ───────────────────────────────                                │
│  [ ] Run: docker exec -it inbound-postgres psql \                │
│           -U inbound -d inbound -c "\dt"                         │
│  [ ] Should list all tables                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Start Inbound Application

### Duration: ~5 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: START APPLICATION                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 5.1: Start Development Server                             │
│  ──────────────────────────────────                             │
│  [ ] Run: bun run dev                                            │
│                                                                  │
│  Expected Output:                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ▲ Next.js 16.x                                              ││
│  │  - Local:        http://localhost:3000                       ││
│  │  - Environments: .env                                        ││
│  │                                                              ││
│  │  ✓ Ready in Xs                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 5.2: Verify Application Running                           │
│  ────────────────────────────────────                           │
│  [ ] Open browser: http://localhost:3000                         │
│  [ ] Should see Inbound landing page or login                    │
│                                                                  │
│  Step 5.3: Verify API Endpoints                                 │
│  ──────────────────────────────                                 │
│  [ ] Open: http://localhost:3000/api/e2/docs                     │
│  [ ] Should see OpenAPI/Swagger documentation                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 6: Create User Account & API Key

### Duration: ~10 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 6: AUTHENTICATION SETUP                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 6.1: Create User Account                                  │
│  ─────────────────────────────                                  │
│  [ ] Navigate to: http://localhost:3000/login                    │
│  [ ] Click "Sign Up" or register                                 │
│  [ ] Enter email and password                                    │
│  [ ] Complete registration                                       │
│                                                                  │
│  Step 6.2: Access Dashboard                                     │
│  ──────────────────────────                                     │
│  [ ] Login with created credentials                              │
│  [ ] Navigate to Settings or API Keys section                    │
│                                                                  │
│  Step 6.3: Generate API Key                                     │
│  ──────────────────────────                                     │
│  [ ] Click "Create API Key"                                      │
│  [ ] Name it: "pet-panic-dev"                                    │
│  [ ] Copy the generated key (shown only once!)                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ⚠️  IMPORTANT: Save this key securely!                      ││
│  │                                                              ││
│  │  API Key: inbound_key_xxxxxxxxxxxxxxxxxxxxxxxx               ││
│  │                                                              ││
│  │  You will need this for:                                     ││
│  │  • Pet Panic Button reply worker                             ││
│  │  • Testing API calls                                         ││
│  │  • Inbound SDK initialization                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 6.4: Store API Key                                        │
│  ───────────────────────                                        │
│  [ ] Add to Pet Panic Button .env:                               │
│      INBOUND_API_KEY=inbound_key_xxxxxxxx                        │
│      INBOUND_BASE_URL=http://localhost:3000                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 7: Register Domain & Email Addresses

### Duration: ~15 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 7: DOMAIN & EMAIL SETUP                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  FOR LOCAL DEVELOPMENT: Use test domain                      ││
│  │  FOR PRODUCTION: Use petpanicbutton.com                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 7.1: Add Domain (Dashboard)                               │
│  ────────────────────────────────                               │
│  [ ] Go to Domains section in dashboard                          │
│  [ ] Click "Add Domain"                                          │
│  [ ] Enter: petpanicbutton.com (or test.local for dev)           │
│                                                                  │
│  Step 7.2: Add Domain (API Alternative)                         │
│  ──────────────────────────────────────                         │
│  [ ] Run:                                                        │
│      curl -X POST http://localhost:3000/api/e2/domains \         │
│        -H "Authorization: Bearer YOUR_API_KEY" \                 │
│        -H "Content-Type: application/json" \                     │
│        -d '{"domain": "petpanicbutton.com"}'                     │
│                                                                  │
│  Step 7.3: Create Email Addresses                               │
│  ────────────────────────────────                               │
│                                                                  │
│  Required addresses (from ADR-008):                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Address                      │ Purpose                      ││
│  │  ─────────────────────────────┼─────────────────────────────││
│  │  waitlist@petpanicbutton.com  │ Waitlist signups             ││
│  │  hello@petpanicbutton.com     │ General inquiries            ││
│  │  faq@petpanicbutton.com       │ FAQ/Contact Us               ││
│  │  clinics@petpanicbutton.com   │ Vet clinic partnerships      ││
│  │  partnerships@petpanicbutton  │ Insurance partnerships       ││
│  │  support@petpanicbutton.com   │ Support (future)             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [ ] Create each address via dashboard or API:                   │
│      curl -X POST http://localhost:3000/api/e2/email-addresses \ │
│        -H "Authorization: Bearer YOUR_API_KEY" \                 │
│        -H "Content-Type: application/json" \                     │
│        -d '{"address": "hello@petpanicbutton.com"}'              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 8: Test Email Reception (Local Simulation)

### Duration: ~15 minutes

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 8: TEST EMAIL FLOW (WITHOUT AWS)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Since we're developing locally without AWS SES/Lambda,          │
│  we simulate incoming emails by posting directly to webhook.     │
│                                                                  │
│  Step 8.1: Understand the Webhook Endpoint                      │
│  ─────────────────────────────────────────                      │
│                                                                  │
│  Endpoint: POST /api/inbound/webhook                             │
│  Auth: SERVICE_API_KEY header                                    │
│                                                                  │
│  Step 8.2: Create Test Script                                   │
│  ────────────────────────────                                   │
│  [ ] Create file: scripts/test-local-webhook.sh                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  #!/bin/bash                                                 ││
│  │                                                              ││
│  │  curl -X POST http://localhost:3000/api/inbound/webhook \    ││
│  │    -H "Content-Type: application/json" \                     ││
│  │    -H "Authorization: Bearer $SERVICE_API_KEY" \             ││
│  │    -d '{                                                     ││
│  │      "type": "email.received",                               ││
│  │      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",        ││
│  │      "email": {                                              ││
│  │        "messageId": "test-'$(date +%s)'@example.com",        ││
│  │        "from": {                                             ││
│  │          "address": "customer@example.com",                  ││
│  │          "name": "Test Customer"                             ││
│  │        },                                                    ││
│  │        "to": [                                               ││
│  │          {"address": "hello@petpanicbutton.com"}             ││
│  │        ],                                                    ││
│  │        "subject": "Question about Pet Panic Button",         ││
│  │        "textBody": "Hi, I saw your app and have a question   ││
│  │                     about how it works for emergency vet     ││
│  │                     visits. Can you help?",                  ││
│  │        "htmlBody": "<p>Hi, I saw your app...</p>",           ││
│  │        "receivedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"      ││
│  │      }                                                       ││
│  │    }'                                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 8.3: Run Test                                             │
│  ──────────────────                                             │
│  [ ] Make executable: chmod +x scripts/test-local-webhook.sh     │
│  [ ] Set env: export SERVICE_API_KEY=dev-service-key...          │
│  [ ] Run: ./scripts/test-local-webhook.sh                        │
│                                                                  │
│  Step 8.4: Verify Email Stored                                  │
│  ─────────────────────────────                                  │
│  [ ] Check database:                                             │
│      docker exec -it inbound-postgres psql \                     │
│        -U inbound -d inbound \                                   │
│        -c "SELECT id, subject, from_address FROM                 │
│            structured_emails ORDER BY created_at DESC LIMIT 5;"  │
│                                                                  │
│  [ ] Should see the test email in results                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 9: Pet Panic Button Reply Worker Setup

### Duration: ~2-3 hours (planning only)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 9: REPLY WORKER ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Location: thepetpanicbutton/services/email-worker/             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    WORKER ARCHITECTURE                       ││
│  │                                                              ││
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   ││
│  │  │   Poller    │────▶│ Classifier  │────▶│   Router    │   ││
│  │  │             │     │  (Ollama)   │     │             │   ││
│  │  └─────────────┘     └─────────────┘     └──────┬──────┘   ││
│  │        │                                         │          ││
│  │        │                         ┌───────────────┼─────┐    ││
│  │        │                         ▼               ▼     ▼    ││
│  │        │                   ┌──────────┐   ┌──────────┐     ││
│  │        │                   │Waitlist  │   │ Support  │ ... ││
│  │        │                   │Auto-Send │   │Queue for │     ││
│  │        │                   └────┬─────┘   │ Review   │     ││
│  │        │                        │         └────┬─────┘     ││
│  │        │                        ▼              ▼            ││
│  │        │                   ┌─────────────────────────┐      ││
│  │        │                   │     Draft Generator     │      ││
│  │        │                   │       (Ollama)          │      ││
│  │        │                   └───────────┬─────────────┘      ││
│  │        │                               ▼                    ││
│  │        │                   ┌─────────────────────────┐      ││
│  │        │                   │    Review Queue DB      │      ││
│  │        │                   │  (pending_replies)      │      ││
│  │        │                   └───────────┬─────────────┘      ││
│  │        │                               ▼                    ││
│  │        │                   ┌─────────────────────────┐      ││
│  │        │                   │  Human Review (Slack)   │      ││
│  │        │                   │  Approve → Send         │      ││
│  │        │                   └───────────┬─────────────┘      ││
│  │        │                               ▼                    ││
│  │        │                   ┌─────────────────────────┐      ││
│  │        └──────────────────▶│   Inbound Send API      │      ││
│  │                            │  POST /api/e2/emails    │      ││
│  │                            └─────────────────────────┘      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Step 9.1: Create Worker Directory Structure                   │
│  ───────────────────────────────────────────                   │
│  [ ] thepetpanicbutton/                                          │
│      └── services/                                               │
│          └── email-worker/                                       │
│              ├── src/                                            │
│              │   ├── index.ts           # Main entry             │
│              │   ├── poller.ts          # Poll structured_emails │
│              │   ├── classifier.ts      # Email classification   │
│              │   ├── drafter.ts         # LLM draft generation   │
│              │   ├── sender.ts          # Inbound API client     │
│              │   └── notifier.ts        # Slack notifications    │
│              ├── templates/                                      │
│              │   ├── waitlist-confirm.ts                         │
│              │   ├── support-reply.ts                            │
│              │   └── partnership-reply.ts                        │
│              ├── .env                                            │
│              └── package.json                                    │
│                                                                  │
│  Step 9.2: Worker Environment Variables                         │
│  ──────────────────────────────────────                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  # Inbound Connection                                        ││
│  │  INBOUND_API_KEY=inbound_key_xxxxxxxx                        ││
│  │  INBOUND_BASE_URL=http://localhost:3000                      ││
│  │                                                              ││
│  │  # Database (read from Inbound's DB)                         ││
│  │  DATABASE_URL=postgres://inbound:inbound@localhost:5432/     ││
│  │               inbound                                        ││
│  │                                                              ││
│  │  # Ollama                                                    ││
│  │  OLLAMA_BASE_URL=http://localhost:11434                      ││
│  │  OLLAMA_MODEL=qwen2.5-instruct:7b                            ││
│  │                                                              ││
│  │  # Slack Notifications                                       ││
│  │  SLACK_WEBHOOK_URL=https://hooks.slack.com/...               ││
│  │  SLACK_REVIEW_CHANNEL=#email-drafts                          ││
│  │                                                              ││
│  │  # Polling Config                                            ││
│  │  POLL_INTERVAL_MS=5000                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 10: Email Classification Logic

### Duration: Planning reference

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 10: EMAIL CLASSIFICATION                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Classification Decision Tree:                                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │  Incoming Email                                              ││
│  │       │                                                      ││
│  │       ▼                                                      ││
│  │  ┌─────────────┐                                             ││
│  │  │ To Address? │                                             ││
│  │  └──────┬──────┘                                             ││
│  │         │                                                    ││
│  │  ┌──────┴───────────────────────────────────────────────┐    ││
│  │  │              │              │              │         │    ││
│  │  ▼              ▼              ▼              ▼         ▼    ││
│  │ waitlist@    hello@        clinics@      support@    other  ││
│  │    │            │              │              │         │    ││
│  │    ▼            ▼              ▼              ▼         ▼    ││
│  │ ┌──────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐ ┌─────┐ ││
│  │ │AUTO  │   │CLASSIFY  │  │PARTNER-  │  │SUPPORT   │ │SPAM │ ││
│  │ │SEND  │   │via LLM   │  │SHIP      │  │QUEUE     │ │CHECK│ ││
│  │ └──┬───┘   └────┬─────┘  └────┬─────┘  └────┬─────┘ └──┬──┘ ││
│  │    │            │             │             │          │     ││
│  │    │     ┌──────┴──────┐      │             │          │     ││
│  │    │     │             │      │             │          │     ││
│  │    │     ▼             ▼      ▼             ▼          ▼     ││
│  │    │  General      Legal   Queue for    Queue for   Discard ││
│  │    │  Inquiry      Issue   Review       Review              ││
│  │    │     │           │        │             │                ││
│  │    ▼     ▼           ▼        ▼             ▼                ││
│  │  Send  Draft +     Draft +  Draft +      Draft +             ││
│  │  Now   Review      Review   Review       Review              ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Classification Prompt Template:                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  You are an email classifier for The Pet Panic Button.      ││
│  │                                                              ││
│  │  Classify this email into ONE of these categories:          ││
│  │  - WAITLIST: Asking to join waitlist                        ││
│  │  - SUPPORT: Help request, bug report, how-to question       ││
│  │  - PARTNERSHIP: Business inquiry from vet/insurer           ││
│  │  - PRESS: Media inquiry                                     ││
│  │  - LEGAL: Legal matter, complaint                           ││
│  │  - SPAM: Unsolicited, irrelevant                            ││
│  │  - GENERAL: Other legitimate inquiry                        ││
│  │                                                              ││
│  │  Email:                                                      ││
│  │  From: {from}                                                ││
│  │  To: {to}                                                    ││
│  │  Subject: {subject}                                          ││
│  │  Body: {body}                                                ││
│  │                                                              ││
│  │  Respond with only the category name.                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 11: Human Review Flow (Slack)

### Duration: Planning reference

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 11: HUMAN REVIEW WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Slack Message Format:                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📧 New Email Needs Review                                   ││
│  │  ─────────────────────────────                              ││
│  │                                                              ││
│  │  From: customer@example.com                                  ││
│  │  To: hello@petpanicbutton.com                                ││
│  │  Subject: Question about the app                             ││
│  │  Category: SUPPORT                                           ││
│  │                                                              ││
│  │  ─── Original Message ───                                    ││
│  │  Hi, I saw your app and wanted to ask...                     ││
│  │                                                              ││
│  │  ─── AI Draft Response ───                                   ││
│  │  Hi there!                                                   ││
│  │                                                              ││
│  │  Thanks for reaching out about The Pet Panic Button!         ││
│  │  [Draft content...]                                          ││
│  │                                                              ││
│  │  Best regards,                                               ││
│  │  The Pet Panic Button Team                                   ││
│  │                                                              ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                      ││
│  │  │ Approve │  │  Edit   │  │ Reject  │                      ││
│  │  └─────────┘  └─────────┘  └─────────┘                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Review State Machine:                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │  ┌──────────┐                                                ││
│  │  │ PENDING  │◀───────────────────────────────┐               ││
│  │  └────┬─────┘                                │               ││
│  │       │                                      │               ││
│  │  ┌────┴────────────────────┐                 │               ││
│  │  │           │             │                 │               ││
│  │  ▼           ▼             ▼                 │               ││
│  │ Approve     Edit        Reject               │               ││
│  │  │           │             │                 │               ││
│  │  ▼           ▼             ▼                 │               ││
│  │ ┌─────┐  ┌────────┐   ┌──────────┐          │               ││
│  │ │SEND │  │EDITING │   │REJECTED  │          │               ││
│  │ └──┬──┘  └───┬────┘   └──────────┘          │               ││
│  │    │         │                               │               ││
│  │    │         └───────── Save ────────────────┘               ││
│  │    │                                                         ││
│  │    ▼                                                         ││
│  │ ┌──────┐                                                     ││
│  │ │ SENT │                                                     ││
│  │ └──────┘                                                     ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 12: Production Deployment Checklist

### Duration: Reference for future

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 12: PRODUCTION DEPLOYMENT (FUTURE)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When ready to move from local dev to production:               │
│                                                                  │
│  Infrastructure:                                                │
│  [ ] Deploy Inbound to Hetzner (Docker)                          │
│  [ ] Set up production PostgreSQL                                │
│  [ ] Configure AWS SES for sending                               │
│  [ ] Deploy Lambda for inbound email processing                  │
│  [ ] Set up S3 bucket for raw email storage                      │
│                                                                  │
│  DNS Configuration:                                              │
│  [ ] MX record → point to SES/Lambda                             │
│  [ ] SPF record → authorize Hetzner IP                           │
│  [ ] DKIM record → generated by SES                              │
│  [ ] DMARC record → policy + reporting                           │
│                                                                  │
│  Security:                                                       │
│  [ ] Generate production API keys                                │
│  [ ] Set up SSL certificates                                     │
│  [ ] Configure webhook signature verification                    │
│  [ ] Set up rate limiting (Redis)                                │
│  [ ] Audit logging for email actions                             │
│                                                                  │
│  Monitoring:                                                     │
│  [ ] CloudWatch alarms for Lambda                                │
│  [ ] Email deliverability monitoring                             │
│  [ ] Error alerting (Sentry/similar)                             │
│  [ ] Uptime monitoring                                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PRODUCTION ARCHITECTURE                                     ││
│  │                                                              ││
│  │  Internet                                                    ││
│  │     │                                                        ││
│  │     ▼                                                        ││
│  │  ┌──────┐    ┌─────┐    ┌────────┐    ┌─────────────────┐   ││
│  │  │ SES  │───▶│ S3  │───▶│ Lambda │───▶│ Inbound         │   ││
│  │  │      │    │     │    │        │    │ (Hetzner)       │   ││
│  │  └──────┘    └─────┘    └────────┘    └────────┬────────┘   ││
│  │                                                 │            ││
│  │                                                 ▼            ││
│  │                                          ┌───────────┐       ││
│  │                                          │ PostgreSQL│       ││
│  │                                          │ (Managed) │       ││
│  │                                          └───────────┘       ││
│  │                                                 │            ││
│  │                                                 ▼            ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │              Pet Panic Reply Worker                      │││
│  │  │                   (Hetzner)                              │││
│  │  │                       │                                  │││
│  │  │                       ▼                                  │││
│  │  │               ┌───────────────┐                          │││
│  │  │               │    Ollama     │                          │││
│  │  │               │  (Hetzner)    │                          │││
│  │  │               └───────────────┘                          │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Complete Startup Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│  DAILY DEV STARTUP SEQUENCE                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Terminal 1: PostgreSQL                                         │
│  ───────────────────────                                        │
│  $ docker start inbound-postgres                                 │
│                                                                  │
│  Terminal 2: Ollama                                              │
│  ──────────────────                                             │
│  $ ollama serve                                                  │
│  (or verify already running: curl localhost:11434)               │
│                                                                  │
│  Terminal 3: Inbound                                             │
│  ───────────────────                                            │
│  $ cd ~/dev/git-repos/github/techno-8/inbound                    │
│  $ bun run dev                                                   │
│                                                                  │
│  Terminal 4: Pet Panic Reply Worker (when implemented)          │
│  ─────────────────────────────────────────────────────          │
│  $ cd ~/dev/git-repos/github/bayvets/thepetpanicbutton/         │
│       services/email-worker                                      │
│  $ bun run dev                                                   │
│                                                                  │
│  Verify All Running:                                             │
│  ───────────────────                                            │
│  • http://localhost:3000 → Inbound dashboard                     │
│  • http://localhost:3000/api/e2/docs → API docs                  │
│  • http://localhost:11434 → Ollama API                           │
│  • PostgreSQL on port 5432                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary: Implementation Order

| Phase | Description | Est. Time | Dependencies |
|-------|-------------|-----------|--------------|
| 1 | Prerequisites & Tools | 30 min | None |
| 2 | Database Setup | 15 min | Phase 1 |
| 3 | Environment Config | 20 min | Phase 2 |
| 4 | Schema Migration | 10 min | Phase 3 |
| 5 | Start Application | 5 min | Phase 4 |
| 6 | Auth & API Keys | 10 min | Phase 5 |
| 7 | Domain & Addresses | 15 min | Phase 6 |
| 8 | Test Webhook | 15 min | Phase 7 |
| 9 | Reply Worker Setup | 2-3 hrs | Phase 8 |
| 10 | Classification | 1-2 hrs | Phase 9 |
| 11 | Human Review | 2-3 hrs | Phase 10 |
| 12 | Production | TBD | All above |

**Total Local Setup (Phases 1-8): ~2 hours**
**Reply Worker Implementation (Phases 9-11): ~5-8 hours**
