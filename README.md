# Shopify Rank Tracker

A modern, scalable application built with **FastAPI** for monitoring and storing Shopify App Store keyword rankings. The project automates keyword searches, captures ranking positions, stores historical data in PostgreSQL, and provides a clean architecture designed for maintainability and future scalability.

---

## Overview

Shopify Rank Tracker helps monitor the visibility of Shopify applications across multiple keywords by performing automated searches in the Shopify App Store. The application records ranking history, captures screenshots for verification, and maintains historical records that can be used for reporting and trend analysis.

Designed with a layered architecture, the project separates business logic, data access, browser automation, and configuration, making it easy to extend and maintain.

---

## Features

* Automated Shopify App Store rank tracking
* Multi-keyword tracking for multiple applications
* Historical ranking storage
* PostgreSQL database integration
* Screenshot capture for ranking verification
* Playwright-powered browser automation
* Modular service-oriented architecture
* Comprehensive logging
* Environment-based configuration
* Easily extensible codebase

---

# Project Structure

```text
app/
├── api/
│   └── tracker.py
├── constants/
│   └── shopify.py
├── core/
│   ├── config.py
│   ├── database.py
│   └── logger.py
├── models/
│   └── ranking.py
├── repositories/
│   └── ranking_repository.py
├── schemas/
│   ├── request.py
│   └── response.py
├── services/
│   ├── browser.py
│   ├── pagination_service.py
│   ├── ranking_service.py
│   ├── search_service.py
│   └── tracker_service.py
├── utils/
│   ├── screenshot.py
│   └── url_utils.py
└── main.py
```

---

# Architecture

The application follows a clean layered architecture.

### API Layer

Handles incoming requests and delegates processing to the service layer.

### Service Layer

Contains the application's business logic, browser automation, keyword search, ranking detection, and workflow orchestration.

### Repository Layer

Responsible for all database interactions and persistence logic.

### Model Layer

Defines SQLAlchemy ORM models representing the database schema.

### Utility Layer

Contains reusable helper functions such as URL processing and screenshot management.

### Core Layer

Manages configuration, database initialization, application settings, and logging.

---

# Technology Stack

* **Python 3.8+**
* **FastAPI**
* **PostgreSQL**
* **SQLAlchemy**
* **Playwright**
* **Pydantic**
* **Uvicorn**

---

# Prerequisites

Before running the project, ensure the following are installed:

* Python 3.8 or later
* PostgreSQL 12 or later
* Playwright Chromium browser

---

# Installation

## Clone the Repository

```bash
git clone <repository-url>
cd rank-tracker
```

## Create a Virtual Environment

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### macOS / Linux

```bash
source venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

Install Playwright browser:

```bash
playwright install chromium
```

---

# Environment Configuration

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/rank_tracker

HEADLESS=False
MAX_PAGES=5

SCREENSHOT_FOLDER=screenshots
```

---

# Database Setup

Create a PostgreSQL database and update the `DATABASE_URL` accordingly.

The application automatically initializes the required database tables during startup.

---

# Running the Application

Start the development server:

```bash
uvicorn app.main:app --reload
```

The application will be available locally once the server starts successfully.

---

# Database Schema

The application stores data across three primary entities:

### Apps

Stores tracked Shopify applications.

### Keywords

Stores all tracked search keywords.

### Ranking History

Stores daily ranking results, page information, screenshot references, and timestamps.

This structure enables long-term historical analysis without duplicating application or keyword information.

---

# Logging

Application logs are written both to the console and log files.

Typical log information includes:

* Application startup
* Browser automation
* Search progress
* Ranking detection
* Database operations
* Errors and exceptions

---

# Future Improvements

* Scheduled tracking using APScheduler
* Redis caching
* Alembic database migrations
* Interactive analytics dashboard
* CSV and Excel export
* Email notifications
* Performance optimizations
* Docker support
* Comprehensive test coverage

---

# Troubleshooting

### Database Connection Issues

* Verify PostgreSQL is running.
* Confirm the `DATABASE_URL` is correct.
* Ensure the target database exists.

### Missing Dependencies

```bash
pip install -r requirements.txt
```

### Playwright Issues

```bash
playwright install chromium
```

### Port Already in Use

Run the application on a different port.

```bash
uvicorn app.main:app --reload --port 8001
```

---

