# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Inbound is an email infrastructure platform that provides programmable email addresses with automatic webhook delivery. Users can send/receive emails via API, manage domains, and process incoming emails through webhooks. The TypeScript SDK is published as `inboundemail` on npm.

## Critical Rules

- **NEVER commit without asking first** - Always check before running `git commit`
- **Use Bun exclusively** - Never use npm, pnpm, or Node.js directly
- **Never run `bun run dev` or `bun run build` without approval**
- **Never run `npx tsc` or type checkers without approval** - This can break the project
- **Use `structuredEmails` table** - `receivedEmails` and `parsedEmails` are deprecated

## Common Commands

```bash
# Development
bun run dev                  # Start dev server (basehub + next)

# Testing
bun run test:e2              # Run e2 API tests
bun run test:e2:domains      # Run domain tests only
bun run test-api             # Run v2 API tests
bun run test-sdk             # Run SDK tests

# Linting
bun run lint                 # Run Biome linter
bun run check                # TypeScript check + Prettier

# Database
bun run db-prepare           # Prepare database
bun run neon:reset           # Reset Neon development branch

# OpenAPI
bun run generate:openapi     # Generate OpenAPI spec
bun run verify:openapi       # Verify OpenAPI spec

# Deployment
bun run deploy:quick         # Full AWS deployment
bun run deploy:lambda        # Lambda only
bun run deploy:cdk           # Infrastructure only
```

## Architecture

### API Layers

The project has multiple API versions in `app/api/`:

- **`/api/e2/`** - Current Elysia-based API (preferred for new features)
  - Uses Elysia framework with Eden for end-to-end type safety
  - OpenAPI docs at `/api/e2/docs`
  - Bearer token authentication
  - Response schemas must use status-code keyed objects, NOT `t.Union()`

- **`/api/v2/`** - Legacy Next.js API routes
  - Being migrated to e2
  - Uses `validateRequest(request)` for auth

### Key Directories

```
app/
├── (main)/              # Dashboard pages (authenticated)
├── (content)/           # Marketing/content pages
├── api/
│   ├── e2/              # Elysia API (current)
│   │   ├── domains/
│   │   ├── emails/
│   │   ├── email-addresses/
│   │   ├── endpoints/
│   │   └── lib/         # Shared Elysia utilities
│   └── v2/              # Legacy Next.js API
└── actions/             # Server actions

features/                # Feature-based organization
├── [feature]/
│   ├── types/           # Type definitions
│   ├── hooks/           # React Query hooks
│   ├── api/             # API service layer
│   └── components/      # Feature components

lib/
├── db/                  # Drizzle ORM and schemas
│   ├── schema.ts        # Main database schema
│   └── domains.ts       # Domain-specific schema
├── aws-ses/             # AWS SES integration
├── auth/                # Better Auth configuration
└── utils/               # Shared utilities

emails/                  # React Email templates
```

### Database

- **ORM**: Drizzle with PostgreSQL (Neon serverless)
- **Types**: Always infer from schema using `$inferSelect` / `$inferInsert`
- **User scoping**: Always filter queries by `userId` for multi-tenant safety

### Authentication

- **Library**: Better Auth with organizations plugin
- **Client**: `lib/auth-client.ts`
- **Server**: `lib/auth/`
- **API Auth**: Bearer tokens via `validateRequest()` helper

### Data Fetching

- **React Query** for client-side data fetching
- **Server Actions** for mutations where appropriate
- Use `Suspense` boundaries with fallback skeletons
- Feature hooks in `features/[feature]/hooks/`

## Elysia API Patterns

### Response Schema (Critical)

Always use status-code keyed objects for OpenAPI documentation:

```typescript
// CORRECT
response: {
  200: SuccessResponse,
  400: ErrorResponse,
  401: ErrorResponse,
  404: ErrorResponse,
}

// WRONG - Response won't show in OpenAPI docs
response: t.Union([SuccessResponse, ErrorResponse])
```

### Standard Endpoint Structure

```typescript
.get('/', async ({ headers }) => {
  const auth = await validateApiKey(headers)
  if (!auth.success) return error(401, { error: auth.error })
  // ... implementation
}, {
  detail: { tags: ['Resource'], summary: 'List resources' },
  response: {
    200: ListResponse,
    401: ErrorResponse,
  }
})
```

## Style Guidelines

- Use component variants, never custom colors/sizes directly
- Use CSS variables from `globals.css`
- No custom border radius on components
- Icons via Nucleo (available through MCP)

## Email Templates

Templates in `emails/` use React Email with Tailwind:
- Brand color: `#7C3AED` (use `bg-brand`)
- Fonts: Outfit (headings) and Geist (body)
- No grid/flex layouts - use tables for email compatibility
- CTA buttons as styled `<Link>` elements

## AWS Email Processing

Email flow: SES → S3 → Lambda → Webhook to API

- Lambda processor in `lambda/email-processor/`
- Infrastructure defined via AWS CDK in `aws/cdk/`
- Emails auto-deleted from S3 after 90 days
