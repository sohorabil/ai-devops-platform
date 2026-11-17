# AI DevOps Platform

A TypeScript service that adds an AI layer to a GitHub CI/CD pipeline: it reviews pull requests automatically, and when a build fails, Claude diagnoses the failure and writes a Standard Operating Procedure (SOP) so the next person knows exactly what to do.

## The problem

When a pipeline breaks, the fix usually lives in one engineer's head. The next time the same failure happens, someone starts from zero. Code review checks (lint, types, vulnerable dependencies) also get skipped when people are busy. This platform makes both automatic: every PR gets the same quality report, and every CI failure leaves behind a written procedure.

## How it works

```
pull request ──▶ GitHub webhook ──▶ /webhook/github (HMAC-SHA256 verified)
                                        │
                                        ▼
                          ESLint + TypeScript + npm audit
                                        │
                                        ▼
                         PR comment: pass/fail table per check

CI fails ──▶ diagnose.yml ──▶ fetch failed job + step ──▶ Claude writes SOP
                                                              │
                                                              ▼
                                         docs/sops/<category>/sop-*.md committed
```

| Piece | What it does |
|---|---|
| `ci.yml` | Quality gate on every push: typecheck, lint, format, tests with coverage, dependency audit, then a Trivy filesystem scan on `dev` and `main` |
| `cd.yml` | On `main`: build and push a Docker image to GHCR, Trivy image scan, email notification |
| `diagnose.yml` | Runs only when CI fails: collects the failed job and step, asks Claude for a root-cause SOP, commits it to `docs/sops/` |
| Webhook service | Verifies GitHub signatures, runs code and dependency checks, posts a review comment on the PR |
| MCP server | Exposes `check_dependencies`, `check_code_quality` and SOP generation as tools Claude can call |
| Observability | Prometheus metrics (`webhook_requests_total`, `pr_reviews_total`, `sop_generated_total`) and a provisioned Grafana dashboard |

## Results so far

- The pipeline caught a real failure on `main` (the test-coverage gate) and the platform generated its first SOP automatically: [docs/sops/pipeline-failures](docs/sops/pipeline-failures/).
- Unit tests cover the PR review, SOP writer, webhook handler, config, logger and metrics modules (`tests/unit/`).

## Run it locally

```bash
npm install
# create .env with ANTHROPIC_API_KEY, GITHUB_WEBHOOK_SECRET, GITHUB_TOKEN (PORT defaults to 3000)
npm run dev                 # webhook service
npm run mcp                 # MCP server over stdio
npm run monitoring:up       # Prometheus + Grafana via Docker Compose
npm run ci                  # the same checks CI runs
```

## How I built this

I designed the flow (webhook → checks → PR comment, and failed CI → Claude → SOP), chose the tools, and directed the implementation with Claude Code. I reviewed and tested each step and ran it against real pipeline runs. One honest limitation: the first generated SOP had to work without the full error log, so its root cause is a list of likely causes rather than a confirmed one. Passing the actual failed-step log to Claude is the next improvement.

## Stack

TypeScript (Node 20) · GitHub Actions · Docker · GHCR · Trivy · Anthropic Claude API · Model Context Protocol (MCP) · Prometheus · Grafana · Vitest
