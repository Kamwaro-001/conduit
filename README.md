# Conduit

Conduit is a node-based workflow automation platform backend built with NestJS. It allows users to create, schedule, and execute complex workflows consisting of different interconnected nodes.

## Key Features

- **Graph-based Workflow Engine**: Executes directed acyclic graphs (DAGs) using BullMQ for reliable background job processing.
- **Real-time Updates**: Provides live execution status updates to clients via WebSockets.
- **Diverse Node Types**: Includes built-in nodes for:
  - Triggers and Cron Scheduling
  - Logic (Conditions, Delays, Regex parsing)
  - Integrations (Webhooks, HTTP Requests, Email via Resend)
  - AI (Image analysis using Google Gemini Vision)
- **User Authentication**: Secure JWT-based auth system.

## Prerequisites

- Node.js
- PostgreSQL
- Redis

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

3. Run the development server:

```bash
npm run start:dev
```

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with watch mode
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run format` - Format code
- `npm run lint` - Lint code
- `npm run seed` - Seed the database
