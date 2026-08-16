---
name: product-design
description: Design and review PH-Ponto user journeys, pt-BR content, responsive layouts, states, accessibility, and PH Motopeças visual consistency. Use for screens, navigation, workflows, component behavior, UI copy, or usability reviews.
---

# PH-Ponto Product Design

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, and the relevant product requirement in `/condexto.md`.
2. Design for the user's immediate decision: employees punch quickly; admins investigate and act confidently.
3. Keep every visible string in natural Brazilian Portuguese. Use `pt-BR` date/time formats and unambiguous signed duration labels.
4. Use compact, calm corporate layouts that remain usable at 1366x768. Prefer hierarchy, spacing, borders, and restrained shadows over decorative effects.
5. Use the real logo only. Derive final brand tokens after inspecting it; never redraw or stretch it.
6. Define loading, empty, error, offline, forbidden, expired-session, saving, and success behavior for every important workflow.
7. Ensure keyboard operation, visible focus, semantic labels, sufficient contrast, clear validation, reduced-motion friendliness, and light/dark themes.
8. Test the rendered workflow at target viewport sizes and record material findings.

Never present an offline punch as accepted. Make destructive or audited actions explicit, and show correction provenance without hiding the original punch.

