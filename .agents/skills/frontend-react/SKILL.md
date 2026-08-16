---
name: frontend-react
description: Implement and test PH-Ponto React renderer features with TypeScript, React Router, TanStack Query, React Hook Form, Zod, Tailwind, and accessible primitives. Use for renderer screens, components, forms, API state, themes, and frontend tests.
---

# PH-Ponto React Frontend

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, and `.agents/skills/product-design/SKILL.md`.
2. Keep server state in TanStack Query, form state in React Hook Form, validation in shared Zod schemas where contracts overlap, and ephemeral UI state local.
3. Route role-specific areas explicitly and treat API authorization failures as authoritative.
4. Centralize the typed API client, normalized error handling, auth refresh coordination, and query keys.
5. Keep tokens out of renderer storage. Use only the narrow typed preload bridge for secure session persistence.
6. Use reusable tokens and components; avoid page-specific copies of controls or status rules.
7. Disable duplicate submissions visually but rely on API idempotency for correctness.
8. Add renderer tests for success and failure states, keyboard interaction, validation, and role visibility. Run typecheck and the relevant tests before checkpointing.

All displayed content, including validation and accessibility labels, must be `pt-BR`. Never calculate authoritative balances or punch timestamps only in the renderer.

