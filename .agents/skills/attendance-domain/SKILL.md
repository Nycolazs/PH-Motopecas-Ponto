---
name: attendance-domain
description: Implement and verify PH-Ponto attendance calculations, punch pairing, schedules, exceptions, balances, statuses, and correction semantics. Use whenever changing expected/worked time, daily/monthly summaries, schedule history, holidays, or time-punch rules.
---

# PH-Ponto Attendance Domain

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, and `/docs/domain-model.md`.
2. Resolve the schedule version effective on the business date, then apply the date-specific exception. `HOLIDAY` and `CLOSED` yield zero expected minutes; `SPECIAL_HOURS` supplies its own interval.
3. Pair effective punches chronologically as IN/OUT intervals. Support any number of complete pairs. An odd count is `INCOMPLETE`; never synthesize an exit. Reject corrections that cross neighboring punches or move to another business date.
4. Sum exact elapsed interval milliseconds and floor the aggregate once to whole worked minutes. Calculate `balanceMinutes = workedMinutes - expectedMinutes` only when the day is complete.
5. Store instants in UTC and perform calendar interpretation in `America/Sao_Paulo` with an explicit time-zone library. Never parse local business timestamps implicitly.
6. Apply every adjustment in order and use the latest effective value while preserving the original and all prior adjustments.
7. Keep calculations pure and deterministic. Require an explicit business date, resolved expectation, effective punches, and `isFinalized` derived from a server `evaluationInstant`. Treat current-day odd punches as `WORKING`, not incomplete.
8. Apply status precedence: incomplete first, then holiday/closed/day-off, then positive/negative/zero balance. On finalized open days, zero punches means missing hours. Special hours uses the balance status.
9. Test weekday normal/overtime/missing, Saturday, closed Sunday, holiday, special hours, zero punches, incomplete punches, multiple intervals, invalid/reordered chronology, correction chains, midnight/DST boundaries, and schedule versioning.

Do not round floating-point hours, hardcode four punches, or mutate historical schedules.
