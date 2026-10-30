# Escala 5x2 (end of 6x1) — analysis and design

Branch: `feat/escala-5x2`. Status: **foundation only** — the scheduling engine
(`packages/shared/src/scheduling`) is implemented and tested; data model, API and screens are
designed here and not built yet. Nothing in this branch changes production behaviour.

User-facing terms stay in pt-BR (escala, folga, troca de folga, jornada).

---

## 1. What the law says (EC 141/2026)

Emenda Constitucional 141, promulgated on 2026-10-16 (from PEC 221/2019), replaces the 6x1
schedule with 5x2.

| When                                                           | Weekly limit | Rest days            | Daily limit                                                                    |
| -------------------------------------------------------------- | ------------ | -------------------- | ------------------------------------------------------------------------------ |
| Until the transition starts                                    | 44 h (CLT)   | 1 DSR                | 8 h (Saturday compensation by agreement)                                       |
| 60 days after publication (15 or 16 Dec 2026 — sources differ) | **42 h**     | **2 paid rest days** | 8 h; a collective agreement may extend the day so the 42 h fit (e.g. 8h24 × 5) |
| One year later (Dec 2027)                                      | **40 h**     | 2                    | 8 h                                                                            |

Other points that drive the design:

- **No salary reduction**, including existing contracts. Jobs already at 40 h or less are not reduced
  further. The hourly divisor changes (220 → 200 at 40 h), which affects overtime (payroll, not this
  system).
- **Without a collective agreement the 42 h stage is effectively 40 h**: two rest days leave five
  workdays, and five days of at most 8 h are 40 h. Reaching 42 h needs 8h24 days, which only an
  agreement/convention allows (Migalhas analysis). → The system asks "Há acordo coletivo?".
- One of the rest days **preferably on Sunday**; the two rest days **need not be consecutive**.
- Compensation regimes other than strict 5x2 only by collective agreement; rest must average two
  days per week within the month with **at least one rest day every seven days**.
- Collective clauses incompatible with the amendment lose effect when the transition starts
  (e.g. 8h48 Monday–Friday to compensate Saturday under 44 h).
- Excluded: public servants; employees with a degree earning ≥ 2.5× the RGPS ceiling.
- A complementary law may give ME/EPP adaptation rules — watch for it.

Rules that already existed and still apply to a store:

- 11 h between the end of a workday and the start of the next (CLT art. 66).
- Break of 1–2 h when the day exceeds 6 h; 15 min between 4 and 6 h (CLT art. 71).
- Commerce may work on Sundays, but the weekly rest must fall on a Sunday at least once every
  three weeks (Lei 10.101/2000, art. 6º). For women, TST case law applies CLT art. 386 (Sunday rest
  every 15 days) — the STF case (RE 1403904) must be checked; the system lets the company choose
  2 or 3 weeks.
- Holidays are not weekly rest days.

Sources: Agência Senado (promulgation, 2026-10-16), Rádio Senado, Migalhas ("Fim da escala 6x1:
sem acordo coletivo, a empresa começa nas 40 horas" and "quando começa a valer"), Exame
("5 dúvidas que empresas precisam esclarecer até dezembro"), Brasil de Fato, TRT-3 (IRDR tema 42),
Findes/Conjur on CLT art. 386. **Not legal advice — validate dates and the union agreement with the
company's accountant/lawyer and the commerce union (sindicato) of Fortaleza.**

---

## 2. Today in PH-Ponto

- One company-wide weekly schedule (`BusinessScheduleVersion` + `BusinessScheduleDay`), versioned by
  effective date, plus date exceptions (holiday / closed / special hours), vacations and the new
  abono/atestado.
- `resolveExpectation` (shared) turns _the company schedule_ into each employee's expected minutes.
  Everybody therefore has the same hours and the same days off.
- PH Motopeças baseline: Mon–Fri 08–17 (lunch 12–13), Saturday 08–12, closed Sunday = 44 h, one rest
  day (6x1).

5x2 breaks the "everybody has the same week" assumption: each employee needs their own days off,
and the store must stay covered Monday to Saturday.

---

## 3. Target model

Three layers, resolved for each employee and date (later wins):

1. **Horário da loja** (existing company schedule) — when the store is open. Used for coverage and
   as the default shift template, no longer as everyone's expected hours.
2. **Escala do colaborador** (new) — a pattern of 1 to 4 weeks with a shift or a folga for each
   weekday, effective from a date (versioned like the company schedule). One week = fixed folga;
   2–4 weeks = rotating folga (e.g. Saturday off every other week).
3. **Exceções da escala** (new) — one date for one employee: _troca de folga_ with a colleague or a
   one-off adjustment. Then company holidays/closures, vacations and abono/atestado apply as today.

Employees without an escala keep using the company schedule, so the feature can be switched on one
person at a time.

### 3.1 Scheduling engine (implemented in this branch)

`packages/shared/src/scheduling` — pure, framework-free, integer minutes, fully tested
(`packages/shared/test/scheduling`):

| Module          | Purpose                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regimes.ts`    | 44 h → 42 h → 40 h timeline (dates are data), `effectiveLimits(date, {hasCollectiveAgreement})`.                                                                                                                                                              |
| `patterns.ts`   | `WorkPattern` (1–4 week cycle + anchor Monday), `ScheduleOverride`, `planRange` → one `PlannedDay` per date.                                                                                                                                                  |
| `compliance.ts` | `checkCompliance(days, options)` → pt-BR issues: weekly/daily hours, rest days, 7th consecutive day, 11 h rest, breaks, Sunday rest every N weeks, holidays not counted as folga.                                                                             |
| `team.ts`       | `coverageFor` (people present per 30 min, gaps below minimum — catches everybody lunching together), `suggestRestDays` (balanced second day off, fixed or rotating, respecting minimum staff), `simulateSwap` (troca de folga re-checked for both employees). |

### 3.2 Data model (to build)

```prisma
model EmployeeScheduleVersion {          // escala do colaborador
  id            String   @id @default(uuid()) @db.Uuid
  employeeId    String   @db.Uuid
  effectiveDate DateTime @db.Date         // unique per employee
  cycleWeeks    Int      @db.SmallInt     // 1..4 (CHECK)
  cycleAnchor   DateTime @db.Date         // a Monday (CHECK extract(isodow)=1)
  note          String?  @db.VarChar(240)
  createdById   String   @db.Uuid
  createdAt     DateTime @default(now())
  days          EmployeeScheduleDay[]
  @@unique([employeeId, effectiveDate])
}

model EmployeeScheduleDay {              // one row per (cycle week, weekday)
  versionId        String  @db.Uuid
  cycleWeek        Int     @db.SmallInt
  weekday          Weekday
  isWorkday        Boolean
  startMinute      Int?    @db.SmallInt
  endMinute        Int?    @db.SmallInt
  breakStartMinute Int?    @db.SmallInt
  breakEndMinute   Int?    @db.SmallInt
  @@id([versionId, cycleWeek, weekday])
}

model ScheduleOverride {                 // troca de folga / ajuste pontual
  id           String   @id @default(uuid()) @db.Uuid
  employeeId   String   @db.Uuid
  businessDate DateTime @db.Date
  isWorkday    Boolean
  startMinute  Int?  ... break fields ...
  reason       ScheduleOverrideReason   // SWAP | ADJUSTMENT
  swapId       String?  @db.Uuid        // both sides of a swap
  note         String   @db.VarChar(240)
  createdById  String   @db.Uuid
  createdAt    DateTime @default(now())
  revokedAt    DateTime?               // cancelled, never deleted (like justifications)
  @@index([employeeId, businessDate])
}

model ScheduleSwapRequest {              // optional: employee asks, admin approves
  id, requesterId, colleagueId, dates Date[], status (PENDING|APPROVED|REJECTED|CANCELLED),
  colleagueAcceptedAt?, reviewedById?, reviewedAt?, comment?
}

// Company settings (AppSetting rows): hasCollectiveAgreement, regime dates override,
// sundayRestEveryWeeks (3 | 2), minimumStaffPerOpenHour.
```

Same conventions as the rest of the schema: append-only history (new version instead of edits),
revocation instead of deletes, audit actions for create/revoke/approve.

### 3.3 Attendance integration

`resolveExpectation` gains an optional employee layer:

```
company schedule → employee escala (if any, for that date's version) → override
  → holiday/closed/special hours → vacation → abono/atestado
```

- Expected minutes = the employee's planned minutes for the date; a planned folga is `DAY_OFF`.
- Holidays still zero the day for everybody who would work.
- Reports, espelho, painel and late-arrival alerts (opening minute = the employee's shift start)
  keep working unchanged because they consume `ResolvedExpectation`.
- Late-arrival alerts must use the employee's shift start, not the store opening.

### 3.4 API (to build, admin unless noted)

- `GET/POST /employees/:id/schedule-versions` — list / publish a new escala version.
- `POST /schedule/preview` — plan + compliance + coverage for a draft (nothing saved).
- `GET /schedule/team?from&to` — team grid with coverage and compliance issues.
- `POST /schedule/overrides`, `POST /schedule/overrides/:id/revoke`.
- `POST /schedule/swaps` (admin creates a troca de folga, validated by `simulateSwap`).
- Employee: `GET /schedule/my?from&to`; `POST /schedule/swap-requests` (propose to a colleague),
  colleague accepts, admin approves.
- `GET/PUT /settings/work-regime` (acordo coletivo, regra do domingo, mínimo por horário).

---

## 4. Screens (simple first)

Guiding rule: the administrator chooses **people and days**, the system does the arithmetic and
explains problems in plain Portuguese before anything is saved.

1. **Escalas da equipe** (new menu item under Ponto & Frequência) — a week grid: rows = colaboradores,
   columns = Seg…Dom. Each cell shows "08–17" or a green "Folga"; a bottom row shows how many people
   are in the store each day, red when below the minimum. Arrows change the week. A side panel lists
   issues ("Semana de 21/12: Mariana com 1 folga; são necessárias 2").
2. **Montar escalas (assistente)** — 4 steps:
   1. Regra da jornada: today's regime and the next one with dates; "A empresa tem acordo coletivo
      que permite 8h24 por dia?" (Sim/Não/Não sei — "Não sei" assumes the safe 40 h).
   2. Horário da loja and the minimum number of people in the store.
   3. Folgas: "Domingo para todos" + "segunda folga" Fixa or Rodízio; the system proposes the
      distribution (`suggestRestDays`) and the admin can drag days.
   4. Revisão: grid, hours per person per week, coverage and issues; "Publicar a partir de [data]".
3. **Escala do colaborador** (tab in the profile) — the person's cycle, hours per week, history of
   versions, "Alterar escala".
4. **Troca de folga** — from the grid: pick two people and the dates; the dialog shows before/after
   for both, and "Confirmar troca" is enabled only when `simulateSwap.allowed`. The swap is recorded
   for both and can be cancelled with a reason.
5. **Aplicativo do colaborador** — "Minha escala" (next 4 weeks, folgas highlighted) and, optional,
   "Pedir troca de folga" to a colleague.
6. **Help** — new guides: "Entender a escala 5x2", "Montar a escala da equipe", "Trocar folga";
   `help-content.test.ts` will require them.

---

## 5. Worked example — PH Motopeças (5 people, store Mon–Sat)

Store today: Mon–Fri 08–17 (lunch 12–13), Sat 08–12, Sunday closed.

**Without a collective agreement (40 h max, 8 h/day):**

- Everyone off on Sunday + one more day spread Mon–Sat (`suggestRestDays`, min. 3 in the store).
- Weekday shift 08–17 with 1 h lunch = 8 h. Someone off on Saturday works 5 × 8 h = 40 h; someone
  off on a weekday works 4 × 8 h + Saturday = 36 h with the store's current Saturday (pay unchanged).
- The current 6x1 (5 × 8 h + 4 h Saturday = 44 h) fails twice after the transition: one rest day short
  and above 40 h — the engine test reproduces this.
- **Stagger lunches** (11:30–12:30 and 12:30–13:30): with everyone at 12–13 the store is empty, which
  `coverageFor` flags.
- Options to discuss: open Saturday until 16 h with whoever works Saturday; rotate the Saturday off
  every week so nobody always gets it.

**With an agreement (42 h):** weekday shift 08:00–17:24 (8h24) and the same rest-day spread.

---

## 6. Rollout plan

1. **Now (before Dec 2026):** decide the agreement question with the accountant/union; settle the
   store hours; enter each person's escala with the assistant while still under 44 h (the system
   warns about weeks after the transition date).
2. **Build** (estimate 2–3 sprints): migrations + API + attendance layer → team grid + assistant →
   troca de folga → employee "Minha escala" → help + screenshots; integration tests for the
   expectation layering and swap approval; browser QA at 1366×768.
3. **Switch-over:** publish escalas effective on the transition date; the espelho of December shows
   weeks before and after correctly because everything is versioned by date.
4. **Dec 2027:** nothing to deploy — the 40 h regime is already in the timeline; re-run the
   assistant to re-check hours.

## 7. Decisions needed from the owner

1. Does PH Motopeças have (or will it sign) a collective agreement allowing 8h24? Without it: 40 h.
2. New store hours (keep Saturday 08–12? extend? open Sundays?).
3. Fixed second day off or weekly rotation? Minimum people in the store at any time?
4. May employees request swaps themselves, or only the admin?
5. Sunday rule for women: 2 weeks (conservative) or 3 weeks (commerce rule)?
6. Exact transition date (15 or 16/12/2026) once the DOU text is confirmed.
