# learning-ai-agent-sdks

This repository contains a collection of small experiments built while learning the **OpenAI Agents SDK** in Node.js. The code in the `openai/` folder shows how to define agents, tools, guardrails, and handoffs between agents using `@openai/agents`.

## Project Structure

- `.git/` – Git repository metadata.
- `openai/` – Node.js project with all agent examples.
  - `package.json` – Project metadata and dependencies (`@openai/agents`, `zod`, `axios`, `dotenv`).
  - `index.js` – Minimal **HelloAgent** that greets users in Hindi or English based on a `location` variable.
  - `agent_manager.js` – Refund and Sales agents demonstrating tools and an agent that can recommend internet plans.
  - `agent_tool.js` – Weather + email tools and an agent that can:
    - Call a weather API (`wttr.in`) to get live weather data.
    - Send real emails using SMTP credentials from environment variables.
  - `agent_handoff.js` – Reception, Sales and Refund agents demonstrating **agent handoff**, where a reception agent routes user queries to the right specialist agent.
  - `input_guard.js` – Example of **input guardrails** for a maths agent. A separate guardrail agent validates that questions are basic arithmetic only and triggers a tripwire for unsafe/irrelevant input.
  - `output_guard.js` – Example of **output guardrails** for a SQL agent. It models a Postgres schema and uses a guardrail agent to check that generated SQL is safe and read-only.

## What is Implemented So Far

So far, this repo demonstrates:

- Creating simple agents with `@openai/agents`.
- Defining **tools** with `zod`-validated parameters (file writes, HTTP calls, email sending).
- Using **environment variables** via `dotenv` (for OpenAI keys, SMTP credentials, etc.).
- Implementing **agent handoffs** where one agent can delegate to another.
- Building **input guardrails** that decide whether to block or allow a query.
- Building **output guardrails** that inspect agent output (like SQL) and can trip a safety check.

Some files are still experimental and may contain small bugs or unfinished code, but they are intended as learning examples rather than production-ready services.

## Getting Started

From the `openai/` folder:

```powershell
cd openai
npm install
npm run dev
```

Then you can run individual scripts, for example:

```powershell
node index.js           # HelloAgent greeting example
node agent_tool.js      # Weather + email tools agent
node agent_handoff.js   # Reception + handoff between agents
node input_guard.js     # Maths input guardrail demo
node output_guard.js    # SQL output guardrail demo
```

Make sure you set your environment variables (e.g. `OPENAI_API_KEY`, SMTP settings) in a `.env` file inside the `openai/` directory before running agents that call external services or send email.
