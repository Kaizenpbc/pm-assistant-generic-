# PM Agent Demo — Analyze & Report

A standalone AI agent that connects to **Kovarti PM Assistant** via the API key auth system, reads all project data, and produces an intelligent portfolio analysis report powered by Claude.

## Prerequisites

- Node.js 22+
- An API key from your PM Assistant instance (Settings → API Keys)
- An Anthropic API key

## Setup

```bash
cd demo-agent
cp .env.example .env
# Edit .env with your actual keys
npm install
```

## Run

```bash
npm start
```

The agent will:

1. Connect to PM Assistant using your API key
2. Fetch all projects, schedules, tasks, analytics, and predictions
3. Display rate-limit header info from the API
4. Stream a Claude-powered portfolio analysis report to the terminal

## What the Report Covers

- Portfolio health overview
- Per-project status and health scores
- Risk identification and severity
- Overdue/at-risk tasks
- Budget analysis and forecasts
- Actionable recommendations
