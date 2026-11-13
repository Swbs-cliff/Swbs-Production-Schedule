# Southwest Body Shop: Production Planner

Collision repair shop in Kansas City, MO (est. 1967). State Farm Select Service (DRP) shop. Owner/manager: Cliff.
Estimating system: CCC ONE. This app schedules repair orders (ROs) from CCC ONE across the technicians' available hours to find and reduce bottlenecks.

## What's here

- `public/index.html`: the whole app. One self-contained page (HTML, CSS and JS inline). No build step.
  Outside loads: Google Fonts only. SheetJS (xlsx 0.18.5) is served from `public/vendor/` for reading .xlsx imports.
- `functions/_middleware.js`: password gate for the whole site (Cloudflare secret `APP_PASSWORD`). A correct login sets a 1-year cookie so the shop monitor stays signed in. `/logout` signs out.
- `functions/api/state.js`: the one shared copy of the schedule, in Cloudflare KV (binding `PLANNER`, key `state`). GET returns it; PUT replaces it unless the stored copy is newer (409 + the newer copy).
- Real CCC ONE exports contain customer names: never commit them (`*.xlsx` and `seed/` are git-ignored).

## Hosting (Cloudflare Pages, free plan)

Cliff chose online + password-protected hosting (11/13/2026). Cloudflare Pages is linked to this GitHub repo, so every push to `main` deploys.
Dashboard settings (not in the repo): build command none, output directory `public`; KV binding `PLANNER`; secret `APP_PASSWORD`.
There is deliberately no `wrangler.toml`: with one, Pages ignores the dashboard bindings.

Local dev: `printf 'APP_PASSWORD=test-pass\n' > .dev.vars && npx wrangler pages dev public --kv PLANNER`.

## Views

- **Planner** (default): KPI tiles, "What to act on" insights, booked-hours vs capacity chart, technician board, job queue, best drop-off day tool, crew & capacity settings.
- **Shop Schedule** (`#shop-schedule`): full-screen TV view for a shop monitor. Shows delivery (customer promise) date, customer, make, and the car's current stage and tech from the technician board. Pages every 12 s. The yellow "Sandbox preview" label shows only when opened as a local file.

## Data and storage

- State (crew, jobs, settings, saved column maps, lastImport) is kept in `localStorage` (`swbs-production-planner-v1`) and, when served over http(s), synced with the shared copy at `/api/state`.
- Sync: `save()` (called on every render) pushes only when the content changed, stamping `state.updatedAt`. Every screen pulls once a minute and on tab focus; a newer server copy wins. The Shop Schedule view reloads the page to apply it, and also reloads after midnight so "today" moves on.
- Sample jobs (`isSample`) are never pushed; the shared copy starts with the first real import.
- Opened as a file (`file://`), the page works offline on localStorage only, as before.

## CCC ONE import (daily routine)

Cliff exports the Production Schedule from CCC ONE each morning and uses **Import from CCC ONE → Daily refresh**.
- Daily refresh: updates matching ROs in place (keeps queue position), adds new ROs in priority order, removes ROs no longer in the export.
- Column matching is automatic (`FIELDS` + `autoMap`) and remembered per header layout (`state.savedMaps`).
- The current export's columns: Scheduled Out, Vehicle In, Repairs Completed, RO Number, Owner, Vehicle, Estimator, Insurance Company, Days in Shop, Parts Received %, Labor Assigned %, Current Phase, RO Hours, Sublet $, Sales $, Body Technician, Paint Technician. Last row is a "Grand Total" (filtered out).
- Mapping: target = Scheduled Out, else Repairs Completed. Drop-off = Vehicle In. Status from Current Phase ("60.1 Refinish - Paint" → In paint, "80.1 Reassembly" → Reassembly, "30.1 Repair - Body" → In body, "[Not Started]" → Ready, "[Scheduled]" → Not arrived, "[No Plan]" or past-dated "[Scheduled]" → Hold).
- **The export has only total RO Hours, no body/refinish split.** The app splits it (refinish share setting, default 40%). Hours are total, not remaining, so in-progress cars are overstated. Best fix: add Body and Refinish hour columns to the CCC ONE report.
- The .xlsx export formats dates as "11/30" with no year; `parseDateAny` picks the year closest to today (before 11/13/2026 these parsed as 2001 and every daily refresh put future cars on Hold).
- Vehicle strings use CCC make codes (HOND, CHEV, TOYO, POLE...). `MAKES` maps them to full names.
- Live CCC data is not available: CCC Secure Share requires registered-developer approval. Cliff chose the daily export route.

## Scheduling rules (in `schedule()` / `runJob()`)

- Stages per job: body repair → paint → reassembly (reassembly = 20% of body hours, done by the same body tech). Frame and mech hours count as body work.
- Each hand-off waits until the next work day (setting).
- Jobs are scheduled in queue order. Auto-sort: cars already being worked first, then priority carriers (default "State Farm"), then everyone else, each by target date.
- Tech assignments from CCC (Body Technician / Paint Technician) lock that stage to that tech. "N/A" = planner picks the tech who finishes soonest.
- **Max 4 labor hours per car per day** (setting `carCap`, 0 = no limit).
- **Customer promise date = estimated completion + 3 work days** (setting `buffer`). Shop Schedule shows the promise date.
- Shop closed dates setting (default 11/26/2026, 12/25/2026, 1/1/2027). Calendar skips weekends unless a tech works Saturday.

## Crew (as of 11/13/2026)

From the CCC export: Andy Robinett (body), Brenon R. (painter, also does whole small jobs), Luis Jasso (painter, also does whole small jobs). Second body tech not yet named ("Body Tech 2").
Defaults are 8 h/day and 100% efficiency except Luis at 4 h/day. **Cliff has not confirmed real hours, efficiency, or whether Luis is part-time or second shift.**
Cliff has also been weighing a restructure: 1 FT body tech, 1 PT body tech who also paints, 1 PT painter (a crew-comparison table in the app models it).

## Design

Matches southwestbodyshop.com: Shop Red #D62828, ink #1E1E1E, light grey #F0F0F0 background, steel blue #457B9D (eyebrow text, body-work color), amber (paint color). Fonts: Anton (big headlines, uppercase), Oswald (section heads, uppercase, letter-spaced), Inter (body), Yellowtail (the red slanted "Southwest" script wordmark with "BODY SHOP" spaced underneath in Oswald). Primary buttons are red pills; secondary buttons are square 2px ink outlines.

## Open items

1. Finish Cloudflare setup and put the monitor on the live address.
2. Confirm crew names, hours, efficiency, and Luis's shift.
3. Get body/refinish hours split in the CCC ONE export.
4. Confirm whether the shop is open Fri 11/27 (day after Thanksgiving).
