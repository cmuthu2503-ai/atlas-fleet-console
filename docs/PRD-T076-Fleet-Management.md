# PRD: T-076 — Unified Fleet Management Page

**PRD ID:** PRD-T076
**Feature Name:** Unified Fleet Management Page
**Status:** Draft
**Author:** Nova (Product Manager)
**Date:** 2026-03-03
**Approved By:** CEO (Design Spec), pending CPO review

---

## Problem Statement

The Atlas Fleet Console currently separates team and agent management across two distinct tabs ("Teams" and "Agents"), forcing users to context-switch between views to understand team composition, agent assignments, and operational status. There is no visibility into per-agent token usage or cost, making resource management blind.

## Goals

1. Merge Teams and Agents into a single "Fleet" tab with a unified two-panel view
2. Provide at-a-glance visibility into agent token usage and cost estimates
3. Enable full CRUD for both teams and agents from one page
4. Maintain dark theme consistency with existing UI

## Non-Goals

- Real-time streaming/WebSocket updates for token usage (polling is sufficient for v1)
- Agent configuration editing (model params, persona, capabilities) — separate detail page
- Cost billing integration or payment processing
- Role-based access control for CRUD operations (future iteration)
- Bulk operations (multi-select agents, batch reassign)

---

## User Stories

| ID | Story | Priority |
|----|-------|----------|
| US-1 | As a fleet operator, I want to see all teams and agents in one view so I can understand fleet composition without switching tabs. | P0 |
| US-2 | As a fleet operator, I want to click a team to filter the agent table so I can focus on a specific team's agents. | P0 |
| US-3 | As a fleet operator, I want to see token usage per agent (today and 7-day) so I can identify high-consumption agents. | P0 |
| US-4 | As a fleet operator, I want to sort agents by token usage and cost so I can optimize spending. | P1 |
| US-5 | As a fleet operator, I want to create a new team via a modal so I can organize agents. | P0 |
| US-6 | As a fleet operator, I want to delete a team with an option to reassign its agents so I don't orphan agents. | P1 |
| US-7 | As a fleet operator, I want to create a new agent and assign it to a team so I can expand my fleet. | P0 |
| US-8 | As a fleet operator, I want to delete an agent with a confirmation dialog so I don't accidentally remove one. | P1 |
| US-9 | As a fleet operator, I want to search/filter agents by name, role, or model so I can quickly find specific agents. | P1 |

---

## Detailed Requirements

### 1. Layout & Navigation

- **Remove** separate "Teams" and "Agents" nav tabs from the sidebar/top nav
- **Add** single "Fleet" tab that navigates to `/fleet`
- **Two-panel layout:**
  - Left panel (Teams sidebar): ~30% width
  - Right panel (Agents table): ~70% width
- Responsive: panels stack vertically on narrow viewports (<768px)

### 2. Teams Sidebar (Left Panel)

- **"All Agents"** option at top — selected by default, shows all agents in table
- List each team as a row showing:
  - Team name
  - Agent count badge (e.g., `(5)`)
  - Status indicator: active / disabled
- **Click behavior:** Selecting a team filters the agents table to agents with matching `teamId`
- **Active state:** Selected team highlighted with gold accent border (`#c4a04a`)
- **"+ New Team" button** at bottom of sidebar → opens Create Team modal

### 3. Agents Table (Right Panel)

| Column | Source | Notes |
|--------|--------|-------|
| Name | `agent.name` | Primary identifier |
| Role | `agent.role` | |
| Model | `agent.model` | |
| Team | `team.name` via `agent.teamId` | |
| Status | `agent.status` | 🟢 active, ⚫ disabled |
| Token Usage | New `/api/agents/:id/usage` | Mini bar showing today + 7-day totals |
| Cost Estimate | Derived from token usage × model rate | Display as `$X.XX` |

- **Sortable** by any column (click column header to toggle asc/desc)
- **Default sort:** Name ascending
- **Search/filter bar** above table: free-text search across name, role, model
- **"+ New Agent" button** in table header area → opens Create Agent modal
- **Row actions** (hover or kebab menu): Delete agent

### 4. Token Usage Display

- **Mini usage bars** in the Token Usage column:
  - Two stacked horizontal bars: "Today" and "7-day"
  - Bar width relative to the highest-usage agent in the current view (auto-scaled)
  - Numeric values displayed alongside: e.g., `12.4k / 89.2k`
- **Tooltip on hover:** Breakdown of input vs output tokens

### 5. CRUD — Teams

#### Create Team Modal
- Fields:
  - **Name** (required, text, max 64 chars)
  - **Description** (optional, textarea, max 256 chars)
- Calls: `POST /api/teams` with `{ name, description }`
- On success: sidebar refreshes, new team appears

#### Delete Team
- Triggered from team context menu (right-click or kebab icon on sidebar item)
- **Confirmation dialog** with:
  - Warning: "This will delete team '{name}'"
  - If team has agents: radio options — "Reassign agents to:" (dropdown of other teams) or "Delete agents too"
  - If team has no agents: simple confirm/cancel
- Calls: `DELETE /api/teams/:id` with optional `?reassignTo=<teamId>`

### 6. CRUD — Agents

#### Create Agent Modal
- Fields:
  - **Name** (required, text, max 64 chars)
  - **Role** (required, text, max 64 chars)
  - **Model** (required, dropdown of available models)
  - **Specialization** (optional, text, max 128 chars)
  - **Team** (required, dropdown of existing teams)
- Calls: `POST /api/agents` with `{ name, role, model, specialization, teamId }`

#### Delete Agent
- Triggered from row action (kebab menu → "Delete")
- **Confirmation dialog:** "Are you sure you want to delete agent '{name}'? This cannot be undone."
- Calls: `DELETE /api/agents/:id`

---

## API Requirements

### New Endpoint: Agent Token Usage

```
GET /api/agents/:id/usage
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `7d` | Time period: `1d`, `7d`, `30d` |

**Response:**
```json
{
  "agentId": "string",
  "usage": {
    "today": {
      "inputTokens": 8420,
      "outputTokens": 3980,
      "totalTokens": 12400
    },
    "period": {
      "inputTokens": 62100,
      "outputTokens": 27100,
      "totalTokens": 89200,
      "periodDays": 7
    }
  },
  "costEstimate": {
    "today": 0.42,
    "period": 2.85,
    "currency": "USD"
  }
}
```

### Batch Usage Endpoint (Performance Optimization)

```
GET /api/agents/usage?teamId=<optional>&period=7d
```

Returns usage for all agents (or filtered by team) in a single call to avoid N+1 queries on the Fleet page.

**Response:** Array of the individual usage objects above.

### Existing Endpoints (No Changes Required)

- `GET /api/teams` — list teams
- `POST /api/teams` — create team
- `DELETE /api/teams/:id` — delete team (add `?reassignTo` query param support)
- `GET /api/agents` — list agents (add `?teamId` filter if not present)
- `POST /api/agents` — create agent
- `DELETE /api/agents/:id` — delete agent

---

## UI Mockup Description

```
┌─────────────────────────────────────────────────────────────┐
│  Atlas Fleet Console              [Dashboard] [Fleet] [Settings]  │
├──────────────────┬──────────────────────────────────────────┤
│  TEAMS           │  AGENTS                    [Search...] [+ New Agent] │
│  ─────────────── │  ──────────────────────────────────────  │
│  ▸ All Agents (12)│  Name     Role    Model   Team   Status  Tokens    Cost  │
│                  │  ─────────────────────────────────────── │
│  ● Alpha (4)     │  Nova     PM      haiku   Alpha   🟢    12k/89k   $2.85 │
│  ● Bravo (5)     │  Linus    Backend opus    Alpha   🟢    45k/210k  $8.40 │
│  ○ Charlie (3)   │  Pixel    Frontend haiku  Bravo   🟢    8k/52k    $1.20 │
│                  │  Scout    Research haiku  Bravo   ⚫    0/1.2k    $0.03 │
│                  │  ...                                     │
│  [+ New Team]    │                                          │
├──────────────────┴──────────────────────────────────────────┤
│  Background: #111117 | Cards: #1e1e24 | Accent: #c4a04a    │
└─────────────────────────────────────────────────────────────┘
```

- ● = active team, ○ = disabled team
- Token column shows mini horizontal bars with numeric labels
- Selected team row highlighted with `#c4a04a` left border

---

## Acceptance Criteria

| # | Criteria | Testable? |
|---|----------|-----------|
| AC-1 | "Teams" and "Agents" nav tabs are removed; single "Fleet" tab exists and navigates to `/fleet` | ✅ |
| AC-2 | Fleet page renders two-panel layout: teams sidebar (~30%) and agents table (~70%) | ✅ |
| AC-3 | "All Agents" is selected by default and shows all agents in the table | ✅ |
| AC-4 | Clicking a team in the sidebar filters the agents table to that team's agents only | ✅ |
| AC-5 | Agents table displays all 7 columns: Name, Role, Model, Team, Status, Token Usage, Cost Estimate | ✅ |
| AC-6 | Token Usage column shows mini bars with today and 7-day numeric values | ✅ |
| AC-7 | All columns are sortable; clicking a column header toggles sort direction | ✅ |
| AC-8 | Search bar filters agents by name, role, or model (client-side filtering acceptable) | ✅ |
| AC-9 | "Create Team" modal collects name + description and creates team via API | ✅ |
| AC-10 | "Delete Team" shows confirmation with agent reassignment option when team has agents | ✅ |
| AC-11 | "Create Agent" modal collects name, role, model, specialization, team and creates via API | ✅ |
| AC-12 | "Delete Agent" shows confirmation dialog before deletion | ✅ |
| AC-13 | `GET /api/agents/:id/usage` returns token usage and cost data | ✅ |
| AC-14 | `GET /api/agents/usage` batch endpoint returns usage for all/filtered agents | ✅ |
| AC-15 | UI uses dark theme: background `#111117`, cards `#1e1e24`, accents `#c4a04a` | ✅ |
| AC-16 | Panels stack vertically on viewports < 768px | ✅ |

---

## Dependencies

- Backend: Token usage tracking/storage must exist or be implemented (logging infrastructure)
- Model pricing rates must be defined for cost estimation
- Existing `/api/teams` and `/api/agents` endpoints must be stable

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token usage data unavailable for historical agents | High | Medium | Show "No data" for agents without usage history; backfill not required for v1 |
| Cost estimates inaccurate due to model pricing changes | Medium | Low | Display as "estimate" with tooltip disclaimer; make rates configurable |
| N+1 API calls for usage per agent | High | High | Batch endpoint (`GET /api/agents/usage`) mitigates this |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page load time (Fleet page) | < 2s | Frontend performance monitoring |
| User tab switches reduced | -100% (no more switching) | Analytics: tab navigation events eliminated |
| Time to identify high-cost agent | < 10s | User testing |
| CRUD task completion rate | > 95% first attempt | User testing |

---

*Assumptions: Token usage data is stored server-side and queryable by agent ID and time range. Model pricing rates are maintained in a configuration file or environment variables.*
