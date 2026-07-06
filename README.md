<h1 align="center">Shopify Rank Tracker</h1>

<p align="center">
  A lightweight, FastAPI-based application for tracking <strong>Shopify App Store</strong> keyword rankings.
  It automates keyword searches, captures ranking positions, stores historical data in PostgreSQL, and helps monitor app visibility over time.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-Latest-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/uv-Package_Manager-purple.svg" alt="uv">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</p>

---

## Features

- 🚀 Automated Shopify App Store keyword tracking
- 📊 Historical ranking storage
- 🔍 Multi-keyword support
- 🗄️ PostgreSQL integration
- 📸 Screenshot capture for verification
- 🎭 Playwright-powered browser automation
- 🏗️ Clean layered architecture
- ⚙️ Environment-based configuration
- 📝 Comprehensive logging

---

## Getting Started

Follow these steps to set up the project locally.

### Prerequisites

Make sure the following are installed:

- Python 3.12 or later
- PostgreSQL
- uv
- Playwright (Chromium)

Install **uv** if you don't already have it:

```bash
pip install uv
```

---

## Installation

### Clone the Repository

```bash
git clone <repository-url>
cd shopify-rank-tracker
```

### Create a Virtual Environment

```bash
uv venv
```

Activate the virtual environment.

**Windows**

```bash
.venv\Scripts\activate
```

**macOS / Linux**

```bash
source .venv/bin/activate
```

### Install Dependencies

```bash
uv sync
```

### Install Playwright Browser

```bash
playwright install chromium
```

---

## Running the Application

Start the FastAPI development server:

```bash
uvicorn app.main:app --reload
```

---

## Configuration

Create a `.env` file in the project root.

```env
DATABASE_URL=postgresql://username:password@localhost:5432/rank_tracker

HEADLESS=False
MAX_PAGES=5

SCREENSHOT_FOLDER=screenshots
```

---

## Project Structure

```text
app/
├── api/
├── constants/
├── core/
├── models/
├── repositories/
├── schemas/
├── services/
├── utils/
└── main.py
```

---

## Architecture

The application follows a clean layered architecture.

- **API Layer** – Handles incoming requests
- **Service Layer** – Contains business logic and browser automation
- **Repository Layer** – Manages database operations
- **Model Layer** – Defines SQLAlchemy models
- **Utility Layer** – Provides reusable helper functions
- **Core Layer** – Handles configuration, logging, and database initialization

---

## Technology Stack

- Python 3.12+
- FastAPI
- PostgreSQL
- SQLAlchemy
- Playwright
- Pydantic
- Uvicorn
- uv
- Pandas
- OpenPyXL

---

## Logging

The application logs important events, including:

- Application startup
- Browser automation
- Keyword search progress
- Ranking detection
- Database operations
- Error handling

---
