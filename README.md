<h1 align="center">Shopify Rank Tracker</h1>

<p align="center">
  A full-stack platform for tracking <strong>Shopify App Store</strong> keyword rankings, analyzing competitor positions,
  auditing app listings with AI, and delivering real-time alerts via Slack.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-v2.1.0-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-18+-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/Vite-Latest-646CFF.svg" alt="Vite">
  <img src="https://img.shields.io/badge/PostgreSQL-Required-336791.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-Required-DC382D.svg" alt="Redis">
  <img src="https://img.shields.io/badge/uv-Package_Manager-purple.svg" alt="uv">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</p>

---

## Overview

Shopify Rank Tracker is a production-ready, full-stack application consisting of:

- **FastAPI Backend** — Handles keyword scraping, ranking persistence, AI-powered listing audits, and REST APIs.
- **React + Vite Frontend** — A modern dashboard for tracking keywords, viewing rank history, managing competitors, and configuring integrations.

---

## Features

### 🔍 Keyword Tracking
- Automated Shopify App Store keyword rank scraping using Playwright
- Multi-keyword support per app
- Historical ranking storage with date-based records
- Screenshot capture for ranking verification

### 📊 Dashboard & Analytics
- Interactive rank trend charts with configurable date ranges (7 / 30 / 90 days)
- Summary metric cards:
  - **Total Keywords** — all tracked keywords
  - **Beating Competitors** — keywords where your app outranks every ranked competitor
  - **Your App in Top 10** — keywords where your app ranks in positions 1–10
  - **Not Ranking** — keywords with no result found in the latest scan
- Ranking history table with keyword grouping, date sorting, and search/filter

### 🏆 Competitor Intelligence
- Add and manage multiple competitor apps per tracked app
- Side-by-side keyword rank comparison in the history matrix
- Competitor rank history charted over time

### 🤖 AI Listing Optimizer
- Gemini-powered audit agent analyzes app title, subtitle, and description
- Provides an overall listing score and actionable improvement suggestions
- Daily audit limit configurable via environment variable

### 🔔 Slack & Webhook Alerts
- Slack OAuth integration for connecting channels
- Automated notifications on rank changes and keyword movements

### 🔐 Authentication & Multi-Tenancy
- JWT-based authentication (email/password + Google OAuth)
- Collaborator system — invite team members to share access to tracked apps
- Per-user app ownership with role-based access

### ⚡ Performance
- Redis caching layer for fast repeated API responses
- PostgreSQL connection pool pre-warming on startup for low-latency first requests
- OpenTelemetry + Logfire observability integration

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.12+ | Runtime |
| FastAPI | API framework |
| SQLAlchemy | ORM |
| PostgreSQL | Primary database |
| Redis | Caching |
| Playwright | Browser automation for scraping |
| Pydantic AI | AI agent framework (Gemini) |
| PyJWT | Authentication tokens |
| Cryptography (Fernet) | Secrets encryption |
| Logfire / OpenTelemetry | Observability & tracing |
| AgentMail | Email collaboration invites |
| uv | Package manager |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool & dev server |
| Material UI (MUI) | Component library |
| Motion (Framer Motion) | Animations |
| Recharts | Rank trend charts |

---

## Project Structure

```text
shopify-rank-tracker/
├── app/
│   ├── api/
│   │   ├── apps.py          # App CRUD, keyword management, competitor endpoints
│   │   ├── auth.py          # Login, register, Google OAuth, token refresh
│   │   ├── collaborators.py # Team invite & collaborator management
│   │   ├── integrations.py  # Slack OAuth & webhook configuration
│   │   ├── keywords.py      # Keyword add/remove/list
│   │   ├── rankings.py      # Ranking history queries
│   │   ├── tracker.py       # Manual scrape trigger endpoints
│   │   └── router.py        # API router aggregation
│   ├── core/
│   │   ├── logger.py        # Structured logging
│   │   ├── redis.py         # Redis client initialization
│   │   └── telemetry.py     # OpenTelemetry setup
│   ├── db/
│   │   └── database_config.py
│   ├── schemas/             # Pydantic request/response models
│   ├── services/
│   │   ├── audit_agent.py        # Pydantic AI listing audit agent
│   │   ├── audit_service.py      # Listing score calculation & caching
│   │   ├── notification_service.py # Slack notification dispatch
│   │   ├── ranking_service.py    # Rank history queries
│   │   ├── search_service.py     # Keyword search orchestration
│   │   ├── slack_service.py      # Slack API integration
│   │   ├── tracker_service.py    # Scraping orchestration
│   │   └── browser.py            # Playwright browser setup
│   ├── constants/           # Shared constants
│   ├── utils/               # Helper utilities
│   └── main.py              # FastAPI app entry point
│
├── shopify-ranker-tracker-ui/   # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── DashBoard.tsx        # Main app dashboard
│       │   ├── HistoryLog.tsx       # Ranking history table + metric cards
│       │   ├── RankChart.tsx        # Trend chart visualization
│       │   ├── CompetitorsPage.tsx  # Competitor analysis page
│       │   ├── ListingOptimizer.tsx # AI listing audit UI
│       │   ├── IntegrationsPage.tsx # Slack & webhook setup
│       │   ├── HistoryPage.tsx      # Full history view
│       │   ├── ProfilePage.tsx      # User profile & settings
│       │   ├── Sidebar.tsx          # Navigation sidebar
│       │   └── LoginRegister.tsx    # Auth pages
│       ├── api.ts           # Typed API client
│       └── App.tsx          # Root app with routing
│
├── migrate_db.py            # Database migration script
├── .env.example             # Environment variable template
├── pyproject.toml           # Python project metadata & dependencies
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+ and npm
- PostgreSQL
- Redis
- uv (Python package manager)
- Playwright (Chromium)

Install **uv**:

```bash
pip install uv
```

---

## Backend Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd shopify-rank-tracker
```

### 2. Create & Activate Virtual Environment

```bash
uv venv
```

**Windows:**
```bash
.venv\Scripts\activate
```

**macOS / Linux:**
```bash
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
uv sync
```

### 4. Install Playwright Browser

```bash
playwright install chromium
```

### 5. Configure Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/rank_tracker

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT Auth
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI Listing Audit (Google Gemini)
GEMINI_API_KEY=your-gemini-api-key
MODEL_NAME=gemini-1.5-pro
DAILY_AUDIT_LIMIT=10

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://your-api-domain.com/api/integrations/slack/oauth/callback

# Email Collaboration (AgentMail)
AGENTMAIL_API_KEY=your-agentmail-api-key
AGENTMAIL_INBOX_ID=your-inbox-id

# Frontend URL (for CORS)
ALLOWED_ORIGINS=http://localhost:5173

# Encryption
FERNET_KEY=your-fernet-key-here

# Google OAuth (optional)
ALLOWED_REDIRECT_URIS=https://your-frontend.com/auth/google/callback

# Observability (optional)
PHOENIX_COLLECTOR_ENDPOINT=
PHOENIX_PROJECT_NAME=
PHOENIX_API_KEY=
```


### 6. Start the Backend Server

```bash
uvicorn app.main:app --reload
```

API docs available at: `http://localhost:8000/api/docs`

---

## Frontend Setup

```bash
cd shopify-ranker-tracker-ui
npm install
```

Create a `.env` file in the `shopify-ranker-tracker-ui/` directory:

```env
VITE_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Frontend available at: `http://localhost:5173`

---

## Architecture

```
┌─────────────────────────────────┐
│        React + Vite UI          │
│  (Dashboard, Charts, Auth, AI)  │
└────────────────┬────────────────┘
                 │ HTTP/REST
┌────────────────▼────────────────┐
│         FastAPI Backend         │
│  ┌──────────┐  ┌─────────────┐  │
│  │ API Layer│  │ Auth / JWT  │  │
│  └────┬─────┘  └──────┬──────┘  │
│  ┌────▼─────────────  │       ┐  │
│  │     Service Layer           │  │
│  │ Scraper │ AI Audit │ Slack  │  │
│  └────┬────────────────────────┘  │
│  ┌────▼──────────┐  ┌──────────┐ │
│  │  PostgreSQL   │  │  Redis   │ │
│  │  (Rankings,   │  │  Cache   │ │
│  │   Users, etc) │  └──────────┘ │
│  └───────────────┘               │
└─────────────────────────────────┘
```

- **API Layer** – Route handlers, request validation, CORS
- **Service Layer** – Business logic: scraping, ranking detection, AI audits, Slack notifications
- **Repository / ORM Layer** – SQLAlchemy models and database queries
- **Cache Layer** – Redis for caching audit results and API responses
- **Auth Layer** – JWT token issuance, refresh, Google OAuth

---

## Logging & Observability

- Structured logging via custom logger (`app/core/logger.py`)
- OpenTelemetry traces exported to Logfire / Arize Phoenix
- Key events logged: startup, DB pool pre-warm, scraping progress, ranking detection, errors

---

