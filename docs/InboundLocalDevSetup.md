# Inbound Local Development Setup

This document describes how to set up Inbound locally for development with the Pet Panic Button backend service.

## Architecture Overview

### Local Development Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPMENT STACK                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Docker     │     │   Inbound    │     │   Ollama     │    │
│  │  PostgreSQL  │────▶│  Next.js App │────▶│  (Remote)    │    │
│  │  Port 5432   │     │  Port 3000   │     │  10.0.0.125  │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Purpose | Location |
|-----------|---------|----------|
| PostgreSQL | Email storage, users, domains | Docker `localhost:5432` |
| Inbound App | Email infrastructure API & UI | `localhost:3000` |
| Ollama | AI model for email responses | `10.0.0.125:11434` |

## Setup Summary

### What Was Created

| Item | Value |
|------|-------|
| User ID | `usr_local_dev_001` |
| User Email | `dev@thepetpanicbutton.com` |
| API Key | `wAqvLXDaTbhwhOlKzBHkjXdHwdwAtybgUmJLjwbqjWOVPOPpstLJDwwmBrBEZMMm` |
| Domain | `thepetpanicbutton.com` |
| Email Address | `support@thepetpanicbutton.com` |

### Files Modified/Created

| File | Purpose |
|------|---------|
| `.env` | Local environment configuration |
| `lib/db/index.ts` | Conditional DB driver (node-postgres for local, neon for prod) |
| `app/api/e2/domains/create.ts` | Autumn billing bypass for dev mode |
| `app/api/inbound/webhook/route.ts` | Autumn billing bypass for dev mode |
| `scripts/create-local-dev-apikey.ts` | Script to generate API keys |
| `scripts/simulate-inbound-email.ts` | Script to simulate incoming emails |

## Integration with Pet Panic Button

### Production Email Flow (AWS)

```
┌─────────────┐     ┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────────────┐
│ Pet Owner   │────▶│  AWS    │────▶│  AWS    │────▶│   Inbound    │────▶│ Pet Panic Button│
│ sends email │     │   SES   │     │ Lambda  │     │   Webhook    │     │    Backend      │
└─────────────┘     └─────────┘     └─────────┘     └──────────────┘     └─────────────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  structured  │
                                                    │   _emails    │
                                                    │    table     │
                                                    └──────────────┘
```

### Local Development Flow (Simulated)

```
┌─────────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ simulate-inbound-   │────▶│ POST /api/inbound│────▶│  structured      │
│ email.ts script     │     │ /webhook         │     │  _emails table   │
└─────────────────────┘     └──────────────────┘     └──────────────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │  Pet Panic Button│
                                                     │  reads emails &  │
                                                     │  generates reply │
                                                     │  via Ollama      │
                                                     └──────────────────┘
```

### Pet Panic Button Environment Variables

Add these to Pet Panic Button's `.env`:

```bash
# Inbound Integration
INBOUND_API_KEY=wAqvLXDaTbhwhOlKzBHkjXdHwdwAtybgUmJLjwbqjWOVPOPpstLJDwwmBrBEZMMm
INBOUND_BASE_URL=http://localhost:3000

# Ollama for AI Responses
OLLAMA_BASE_URL=http://10.0.0.125:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

### Using the Inbound SDK

```typescript
import { Inbound } from "inboundemail";

const inbound = new Inbound(process.env.INBOUND_API_KEY!, {
  baseUrl: process.env.INBOUND_BASE_URL,
});

// List received emails
const emails = await inbound.emails.list();

// Get specific email
const email = await inbound.emails.get(emailId);

// Send reply
await inbound.emails.reply(emailId, { body: aiGeneratedResponse });
```

## Daily Startup Routine

```bash
# 1. Start PostgreSQL (if not running)
docker start inbound-postgres

# 2. Start Inbound dev server
cd /path/to/inbound
bun run dev

# 3. Verify Inbound is running
curl http://localhost:3000/api/e2/domains \
  -H "Authorization: Bearer $INBOUND_API_KEY"

# 4. Start Pet Panic Button backend
cd /path/to/thepetpanicbutton
# ... your start command

# 5. (Optional) Simulate test email
bun run scripts/simulate-inbound-email.ts
```

## Testing Email Flow

### Simulate an Incoming Email

```bash
bun run scripts/simulate-inbound-email.ts
```

This sends a test email to `support@thepetpanicbutton.com` with:
- From: `petowner@example.com`
- Subject: "Help! My dog ate chocolate!"
- Body: A worried pet owner message

### Verify Email Was Stored

```bash
docker exec inbound-postgres psql -U inbound -d inbound \
  -c "SELECT id, recipient, subject, created_at FROM structured_emails ORDER BY created_at DESC LIMIT 5;"
```

### Access Web Interface

Open `http://localhost:3000` in your browser to access the Inbound dashboard.

## FAQ

### Q: Where are emails stored?

All received emails are stored in Inbound's PostgreSQL database in the `structured_emails` table. This includes:
- Full email content (text and HTML)
- Parsed headers (from, to, subject, date)
- Attachments (as JSON)
- Processing metadata

### Q: Is there a web interface?

Yes, Inbound has a web dashboard at `http://localhost:3000`. It provides:
- View received emails and their status
- Manage domains and email addresses
- Configure webhooks/endpoints for routing
- View delivery logs and analytics

Note: It's an email infrastructure dashboard, not a Gmail-like inbox.

### Q: Are there alternatives to AWS Lambda?

Yes, several alternatives exist for processing incoming emails:

| Alternative | Description | Complexity |
|-------------|-------------|------------|
| **SES HTTP Action** | SES can POST directly to an HTTPS endpoint | Medium |
| **SendGrid Inbound Parse** | Webhooks emails directly to your endpoint | Low |
| **Mailgun Routes** | Similar webhook-based approach | Low |
| **Postmark Inbound** | Webhook-based, good deliverability | Low |
| **Cloudflare Email Workers** | Edge-based email processing | Medium |
| **Self-hosted (Postal/Mailcow)** | Full control, no cloud dependency | High |

For local development, the Lambda is bypassed entirely using the `simulate-inbound-email.ts` script.

### Q: Why do I see Autumn billing errors?

Autumn is a billing/usage tracking service. For local development without Autumn credentials, the codebase has been modified to bypass these checks when:
- `NODE_ENV=development`
- `AUTUMN_SECRET_KEY` is not set

### Q: How do I regenerate an API key?

```bash
bun run scripts/create-local-dev-apikey.ts
```

Then update your `.env` files with the new key.

## Troubleshooting

### Database Connection Error (Neon SSL)

If you see `NeonDbError: Error connecting to database: unknown certificate verification error`, ensure `lib/db/index.ts` has the conditional driver logic that uses `node-postgres` for localhost connections.

### Autumn Billing Errors

If you see `Autumn secret key or publishable key is required`, ensure the relevant API endpoints have dev mode bypass logic checking for `NODE_ENV=development` and missing `AUTUMN_SECRET_KEY`.

### Email Not Processing

Check server logs for errors:
```bash
# If running in background
tail -f /path/to/server/output

# Or check the webhook response
curl -X POST 'http://localhost:3000/api/inbound/webhook' \
  -H 'Authorization: Bearer dev-service-key-inbound-local-12345' \
  -H 'Content-Type: application/json' \
  -d '{"type":"ses_event_with_content","processedRecords":[]}'
```

## Next Steps

1. **Phase 9**: Configure Pet Panic Button reply worker to connect to Ollama
2. **Phase 10**: Test AI reply generation with qwen2.5:7b-instruct
3. **Phase 11**: End-to-end test (email in → AI response out)
4. **Phase 12**: Finalize daily startup routine and documentation
