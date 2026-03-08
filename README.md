# Atlas Fleet Console

Atlas Fleet Console is a product and operations workspace for an AI-native organization. It combines org design, agent fleet management, delivery tracking, model discovery, and prompt benchmarking in one single-page application.

At a practical level, this repository is an internal control plane for:

- visualizing a leadership hierarchy of specialized AI agents
- managing teams and agent assignments
- tracking tasks, delegation chains, stories, bugs, and workflow state
- estimating agent activity, token usage, and cost from local operational records
- discovering live AWS Bedrock models and checking which ones are currently callable
- comparing curated model rankings with live Bedrock availability
- racing the same prompt across multiple models and saving prompt variants to a local library

This is best understood as an operator console and product prototype, not a full autonomous agent runtime. The UI manages and visualizes operational records; it does not run a long-lived multi-agent execution engine from the browser.

## What the Application Does

The application has seven primary surfaces:

| Surface | Purpose | What users do there |
| --- | --- | --- |
| Org Chart | Show the AI organization structure | View the CEO, COO, CTO, CPO, functional teams, and reporting lines |
| Fleet | Operate the agent fleet | Create/delete teams and agents, enable/disable them, assign models, and inspect usage/cost rollups |
| Task Traces | Explain how work moved through the org | Review task delegation chains and story status histories in timeline form |
| Jira Board | Manage delivery execution | Create stories, move work through workflow columns, inspect bugs, and review story history |
| Model Advisor | Explore live Bedrock supply | Filter Bedrock models by provider/capability and rank them by fit for common use cases |
| Model Rankings | Compare model families strategically | Overlay curated ranking data with live Bedrock listing/active status |
| Prompt Racer | Benchmark prompts across models | Run the same prompt against OpenAI and Bedrock models, optimize prompts, and save them to a prompt library |

Navigation is hash-based inside the SPA. Useful deep links are:

- `#orgchart`
- `#fleet`
- `#traces`
- `#board`
- `#models`
- `#rankings`
- `#prompt-racer`

## Product Perspective

The product models an AI organization in three layers:

1. Organization layer
   Teams and agents represent the operating structure of the company.
2. Delivery layer
   Tasks, delegation steps, stories, bugs, and story history describe how work moves and where it gets stuck.
3. Model layer
   Bedrock discovery, rankings, and prompt racing help decide which LLMs should power different agent roles.

That combination makes the console useful for several personas:

- AI operations leads who need to see fleet composition, activity, and ownership
- engineering and product leaders who want to track delivery flow across agents
- model/platform owners who need to compare model options and prompt performance

## Detailed Feature Tour

### 1. Org Chart

The Org Chart view is a leadership and reporting visualization for the seeded AI company:

- CEO and COO at the top
- CTO and CPO branches underneath
- grouped engineering, QA, AI/data, consulting, and product teams
- collapsible executive cards for progressively drilling into the structure

This screen is mainly for orientation. It answers, "Who exists in this organization, what role do they play, and who do they report to?"

### 2. Fleet

Fleet is the operational core of the app.

Users can:

- list all teams in a sidebar and filter the table by team
- create new teams and new agents
- enable/disable teams and agents
- delete teams and agents
- inspect estimated token/cost usage per agent
- expand an agent row for detailed 24h, 7d, and all-time activity summaries
- assign or clear a model for an agent
- use live Bedrock availability to drive model assignment options
- see heuristic model recommendations based on the agent's role/persona/specialization

Important detail: the usage and cost numbers in Fleet are not direct provider billing data. They are local estimates derived from tasks, delegation events, stories, bugs, and history entries stored in SQLite.

### 3. Task Traces

Task Traces merges two kinds of operational records into one explainability view:

- tasks and their delegation chains
- stories and their status-change history

This is the "why did work move this way?" screen. It helps someone reconstruct:

- who assigned work
- who delegated it onward
- how story status progressed
- whether a task/story is still active, done, or stuck

### 4. Jira Board

The board is a multi-column delivery workflow for user stories. It supports:

- ten workflow states from `backlog` to `done`
- filters for status, priority, sprint, and assignee
- board-level stats such as total stories, bug count, and average bug loop count
- story creation
- moving stories between statuses
- story detail modals with:
  - description and acceptance criteria
  - bug list and bug creation
  - story history
  - delegation steps for the linked task

The board also keeps story state aligned with linked tasks. For example, moving a story to `done` updates the linked task status to `completed`.

### 5. Model Advisor

Model Advisor is a live AWS Bedrock exploration tool.

It:

- calls Bedrock to list foundation models in a selected region
- infers tags such as `chat`, `code`, `analysis`, `rag`, and `creative`
- derives heuristic scores for quality, latency, cost, and context
- filters by provider and capability
- can run active checks against models to determine whether they actually respond in the current account/region
- ranks models against common use cases such as coding, conversational, budget, long-context, and agentic workflows

This screen depends on valid AWS credentials and Bedrock access.

### 6. Model Rankings

Model Rankings is more strategic than Model Advisor.

It combines:

- a curated ranking dataset in `src/client/components/models/model-rankings-data.ts`
- live Bedrock catalog listings
- optional Bedrock active checks

The screen lets a user compare model families by views such as:

- popularity
- human preference
- capability
- operations

It then overlays whether a model is:

- Bedrock Active
- Bedrock Listed
- Not in Bedrock

This makes it useful for model portfolio decisions, not just raw catalog browsing.

### 7. Prompt Racer

Prompt Racer is a prompt benchmarking workspace embedded inside the main app.

It supports:

- selecting up to 4 models at a time
- mixing OpenAI presets with live Bedrock models
- entering a prompt, system prompt, temperature, max tokens, and Bedrock region
- running the same prompt across selected models
- comparing responses side by side with latency and token summaries
- optimizing a draft prompt with a selected model
- saving reusable prompts to a local prompt library with notes, tags, favorites, and usage counts

Prompt Racer uses:

- OpenAI for models like `gpt-5`, `gpt-5-mini`, and `gpt-5-nano`
- AWS Bedrock for live Bedrock models
- SQLite for the prompt library

## Domain Model

The core entities are:

- `teams`
  organizational groups with name, description, channel, and status
- `agents`
  the AI workers/leaders with role, persona, specialization, model, capabilities, team, and parent agent
- `tasks`
  operational work items with assignment, priority, and status
- `delegation_steps`
  task handoffs between agents
- `user_stories`
  board items linked to tasks and delivery gates
- `bugs`
  defects associated with a story
- `story_history`
  the audit trail of story status changes
- `prompt_library`
  saved prompts for Prompt Racer

The seeded demo dataset creates:

- 4 teams
- 20 agents
- 8 tasks
- 22 delegation steps
- 8 user stories
- 4 bugs
- story history records for workflow playback

## How Metrics and Recommendations Work

This part matters because several screens use heuristics.

### Token and cost usage

Fleet usage is computed locally from stored events, not from real provider telemetry.

The `/api/fleet/agents/:id/usage` endpoint builds a rollup from:

- tasks assigned to or created by the agent
- delegation steps involving the agent
- stories assigned to the agent
- bugs found by or assigned to the agent
- story history entries where the agent appears as the changer

It then applies model-specific rate heuristics to estimate cost.

That means the numbers are useful for relative operational insight, but they are not billing-grade.

### Model recommendations

Fleet model recommendations are also heuristic. The app scores live Bedrock models against the agent's role/persona/specialization and produces ranked suggestions.

### Model rankings

The Model Rankings screen uses a curated dataset with manually maintained scores and rationale text, then enriches it with live Bedrock state.

## Architecture

### Frontend

- React 19
- Vite
- TanStack Query
- Tailwind CSS v4
- Zustand

The frontend lives under `src/client`.

### Backend

- Hono on Node.js
- Drizzle ORM
- SQLite via `better-sqlite3`
- AWS SDK for Bedrock discovery/runtime
- direct OpenAI Responses API calls for OpenAI-backed inference

The backend lives under `src/server`.

### Persistence

- SQLite database file: `./data/fleet.db`
- prompt library is auto-created on server startup if missing
- the rest of the operational schema should be created via migration or seed

### Deployment shape

Local development:

- Vite frontend on `http://localhost:5173`
- Hono backend on `http://localhost:3590`
- Vite proxies `/api/*` to the backend

Docker Compose:

- nginx frontend on `http://localhost:8088`
- backend API on `http://localhost:3590`

Production-style local run:

- `npm run build`
- `npm run start`
- production frontend proxy on `http://localhost:3000`
- backend still on `http://localhost:3590`

## Repository Layout

| Path | Purpose |
| --- | --- |
| `src/client` | React UI, queries, types, and view components |
| `src/server` | Hono API, Bedrock/OpenAI integrations, and production server |
| `src/server/db` | SQLite client, schema, and seed script |
| `docs` | product docs and model-ranking exploration artifacts |
| `data` | local SQLite database file location |
| `Dockerfile.backend` | backend container |
| `Dockerfile.frontend` | frontend build + nginx container |
| `docker-compose.yml` | local multi-container setup |

## API Overview

Main route groups:

- `/api/health`
- `/api/fleet/agents`
- `/api/fleet/teams`
- `/api/fleet/tasks`
- `/api/fleet/tasks/:taskId/delegation-steps`
- `/api/stories`
- `/api/board/stats`
- `/api/bugs`
- `/api/bedrock/models`
- `/api/bedrock/active-models`
- `/api/prompt-racer/library`
- `/api/prompt-racer/race`
- `/api/prompt-racer/optimize`

Notable specialized endpoints:

- `POST /api/fleet/agents/:id/respond`
  make an agent answer as itself using its configured OpenAI model
- `GET /api/fleet/agents/:id/usage`
  get estimated activity, tokens, and cost for a single agent
- `GET /api/fleet/agents/name-suggestions`
  suggest agent names by specialization
- `GET /api/fleet/agents/model-recommendation`
  return a lightweight specialization-to-model recommendation

## Local Development

### Prerequisites

- Node.js 22+ recommended
- npm
- optional AWS credentials with Bedrock access
- optional OpenAI API key

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize the database

Choose one of the following:

```bash
# Creates the schema without demo data
npm run db:migrate
```

```bash
# Destructive: rebuilds the main operational tables and loads demo data
npm run db:seed
```

Use `db:seed` if you want the console to look like the intended demo immediately. It is destructive by design.

### 3. Start the backend

```bash
npm run dev:server
```

Backend URL:

```text
http://localhost:3590
```

### 4. Start the frontend

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Environment Variables

### OpenAI

Required for:

- OpenAI models in Prompt Racer
- `POST /api/fleet/agents/:id/respond` when the agent's model is an OpenAI model

```bash
OPENAI_API_KEY=...
```

### AWS / Bedrock

Required for:

- Model Advisor
- Bedrock-backed portions of Model Rankings
- Bedrock models in Prompt Racer
- live Bedrock-backed model choices in Fleet

Supported patterns:

```bash
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1
AWS_PROFILE=default
AWS_SDK_LOAD_CONFIG=1
```

or:

```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

If AWS variables are missing or invalid, the core fleet/board views still work, but model discovery/racing features will fail or return empty/error states.

## Docker

Start the stack:

```bash
docker compose up -d --build
```

Then initialize the database inside the running backend container:

```bash
# Empty schema
docker compose exec backend npm run db:migrate
```

or:

```bash
# Demo data
docker compose exec backend npm run db:seed
```

Open:

- frontend: `http://localhost:8088`
- backend API: `http://localhost:3590`
- health check: `http://localhost:3590/api/health`

Why the explicit DB init step matters:

- Docker mounts `./data` from the host into the backend container
- that bind mount becomes the active database location
- you should run `db:migrate` or `db:seed` against that mounted database at least once

## Seed Data Narrative

The seeded workspace is intentionally opinionated. It represents an AI company with:

- leadership agents such as CEO, COO, CTO, and CPO
- engineering specialists such as backend, frontend, security, DevOps, QA, AI/ML, data, and retrieval
- a consulting office reporting into the CTO
- a product manager and program manager
- example delivery work already moving through tasks, stories, bugs, and delegation chains

This makes the console demo-ready immediately after seeding.

## Current Boundaries and Known Gaps

- No authentication or RBAC is enforced. `src/server/middleware/auth.ts` is currently a pass-through placeholder.
- Messaging UI scaffolding exists under `src/client/components/messaging`, but it is not wired into the main navigation and there is no corresponding backend messaging/WebSocket route in this repo.
- Token and cost figures are estimated from local event history, not real provider usage exports.
- Bedrock availability depends on the current AWS account, region, and entitlements.
- OpenAI-backed features require `OPENAI_API_KEY`.
- There is no test script or automated test suite configured in `package.json` yet.

## Recommended First Run for a New Contributor

If you want to understand the application quickly, use this sequence:

1. `npm install`
2. `npm run db:seed`
3. `npm run dev:server`
4. `npm run dev`
5. open `http://localhost:5173`
6. visit the tabs in this order: `Org Chart`, `Fleet`, `Task Traces`, `Jira Board`, `Model Advisor`, `Model Rankings`, `Prompt Racer`

That path tells the clearest story of what the product is trying to become.
