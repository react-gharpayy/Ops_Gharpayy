I’ll implement this as one coordinated upgrade across the dashboard, owner portal, and PiP system.

## Outcome

The app will become a WhatsApp-parallel operating panel with:

1. Slim role-based navigation instead of bloated sidebars.
2. A stronger owner portal that reflects Flow Ops + TCM activity, not random generic dashboards.
3. Liquid PiP across layouts.
4. Two separate PiP modes:
   - Lead Capture PiP: paste WhatsApp lead text and add leads fast.
   - Lead Management PiP: review/update old, new, future, and past leads.
5. Cross-role improvements that surface persona-specific work instead of generic lists.

## Implementation Plan

### 1. Slim navigation for every role

Update `AppShell` navigation so each role has a focused primary sidebar, with noisy/secondary pages moved into a “More / Tools” section.

Keep approximately:

- HR: Today, War Room, Team, Revenue, Funnel, Zones, Owners, Supply Hub.
- Flow Ops: Today, Inbox, Leads, Schedule, Calendar, Marketplace, Supply Hub, Outreach.
- TCM: Today, TCM Desk, My Tours, Follow-ups, Calendar, Marketplace, My Stats, Handoffs.
- Owner: Owner Home, Approvals, Inventory/Rooms, Visits, Insights.

Remove duplicates from primary nav:
- multiple leaderboard entries
- overlapping manager/war-room/HR tower routes from main nav
- health/help from main nav
- duplicate tours/leads routes where they confuse the role

The routes will still exist where useful, but will not overload the main workflow.

### 2. Add role-persona “Today” intelligence

Wire existing `personas.ts` data into the role experience:

- TCM: show weak-spot nudge, mission, next best action, streak/commission-style motivation.
- Flow Ops: show load-balancing suggestions, duplicate/paste-import prompts, SLA pulse.
- HR: show people-focused cards instead of lead-only cards: who needs help, who is slipping, where revenue/SLA is bleeding.
- Owner: show owner-specific “what changed / what to approve / what is vacant” cards.

This will use current mock/store data and avoid adding fake unrelated content.

### 3. Consolidate HR command experience

Make HR feel like one command center rather than many dashboards:

- Keep War Room as the primary HR command page.
- Add mode sections/tabs/cards for:
  - People health
  - Revenue pace
  - SLA breach autopsy
  - Owner supply issues
- De-emphasize `/manager` and `/myt` from primary nav.

### 4. Upgrade Owner Portal with real operational alignment

Refactor owner-facing UX to be more specific and useful:

Owner Home will focus on:
- Status Today: occupancy, sellable rooms, pending approvals, locked rooms.
- What Flow Ops needs from owner: block approvals, room verification, media freshness.
- What TCM is doing: visits, lead demand, tenant intent signals.
- Owner action queue: approve, verify, update price, refresh photos.
- Payout/revenue lens: simple, owner-friendly cash view.

Remove or reduce generic/random-feeling charts and demo switcher emphasis. Keep data tied to existing owner context, rooms, block requests, media, visits, objections, and compliance.

Also simplify owner navigation to a smaller portal:
- Home
- Approvals
- Rooms / Inventory
- Visits
- Insights

### 5. Build dual PiP mode system

Extend `PipProvider` from a single generic PiP into a mode-aware system.

New PiP modes:

#### A. Lead Capture PiP
Purpose: add leads from WhatsApp as fast as possible.

Features:
- Compact paste box at top.
- Auto-parse WhatsApp text into the existing full lead schema.
- Save lead.
- Save + next.
- Duplicate warning.
- Minimal fields always visible: name, phone, areas, budget, move-in, stage, assignee.
- Optimized for 420–560px width.

Button label:
- `PiP Add Lead`

#### B. Lead Management PiP
Purpose: update and process leads without returning to main dashboard.

Features:
- Search bar.
- Compact lead list.
- Filters/chips:
  - New lead
  - Old lead
  - Future lead
  - Past lead
- Quick status/stage update.
- Call/WhatsApp shortcut.
- Notes/follow-up quick actions.
- Selected lead micro timeline from current activities/calls/messages where available.

Button label:
- `PiP Manage Leads`

### 6. Make PiP liquid across layouts

Improve PiP rendering so it works cleanly on desktop/laptop and small floating window sizes:

- PiP-specific layout class on the PiP document/root.
- Hide heavy sidebar/header when in PiP mode where needed.
- Use compact spacing and sticky actions.
- Add shrink/expand controls inside PiP.
- Keep browser fallback clear if Document Picture-in-Picture is unavailable.

### 7. Keep route/state continuity

Improve state continuity between the main tab and PiP:

- Keep existing same React store behavior for portal-based PiP rendering.
- Extend BroadcastChannel sync for route/view mode/filter/selected lead events where needed.
- Ensure updating a lead in PiP immediately reflects when the user switches back.
- Ensure selected lead/search/filter state can be mirrored between the main view and PiP management panel.

### 8. Add lead lifecycle buckets

For PiP Manage Leads, classify leads into:

- New: recently created or untouched.
- Old: stale/no recent activity.
- Future: move-in/follow-up/tour scheduled ahead.
- Past: completed, dropped, booked, old move-in date, or finished tour context.

These are UI classifications derived from existing lead/tour/follow-up fields; no database changes required.

### 9. Validation

After implementation I will run:

- TypeScript check/build validation.
- Parser-related tests where available.
- Manual code validation for PiP support/fallback paths.
- Ensure no imports target missing files and no `routeTree.gen.ts` manual edits are needed.

## Technical Files Likely To Change

- `src/components/AppShell.tsx`
- `src/components/pip/PipProvider.tsx`
- `src/components/pip/PipButton.tsx`
- `src/components/pip/usePipSync.ts`
- new PiP components such as `LeadCapturePipPanel` and `LeadManagePipPanel`
- `src/myt/pages/MYTLeadTracker.tsx`
- `src/components/leads/QuickAddLeadPanel.tsx`
- owner pages/components under `src/owner/pages/*`
- possibly small helper modules for lead lifecycle classification and persona action cards

## Notes

I’ll keep this as a front-end/store-level upgrade using existing local app stores and mock/context data. I won’t add backend/database work unless you later ask for persistence beyond the current app state.