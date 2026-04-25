# 30x Inventory-Aligned Operating Plan

## Outcome

Make the CRM feel like each user owns their work, while the system manages the routing underneath:

- Every pasted lead is instantly matched to available inventory in the requested area.
- Every Flow Ops person gets a different area/goal board.
- Every TCM gets a different tour-closing board based on their zone and assigned supply.
- HR sees whether Flow Ops, TCMs, and Owners are producing results.
- Owners see how their inventory is being used to create tours and bookings.
- Use the word “Tours” everywhere, not “Visits”.

Core operating loop:

```text
Lead paste → parse → duplicate check → area demand → inventory match → Flow Ops schedules Tour → TCM closes Tour → HR monitors → Owner supplies rooms
```

## 1. Inventory-first Quick Add

Upgrade Quick Add so it does not just parse a lead; it immediately answers:

- Which area did this lead ask for?
- Which inventory is available in that area?
- Which property should be pitched first?
- Which Flow Ops owner should work this lead?
- Which TCM should take the Tour if scheduled?
- What is the next action?

Inside `QuickAddLeadPanel`:

- Keep paste-first zero-click parsing.
- After parsing, show an “Area Inventory Fit” block above the form:
  - requested areas
  - matching properties
  - available beds/rooms
  - price fit against budget
  - gender/room fit
  - distance/commute estimate where known
  - best property to pitch
- Add a one-click “Schedule Tour with best property” action.
- If duplicate found, show only one decision point:
  - “Use existing lead and schedule Tour”
  - no phone refill, no repeated questions.

## 2. Area-personalized Flow Ops boards

Flow Ops goal: schedule Tours.

Each Flow Ops person should see a different board based on their assigned zone/area and available inventory.

Add/upgrade Flow Ops page with:

- My Area Goal: “Schedule X Tours today in Koramangala/HSR/etc.”
- Area inventory pressure:
  - hot areas with vacant beds
  - cold areas needing demand
  - properties with rooms available now
- Lead-to-inventory queue:
  - leads grouped by requested area
  - best matching property beside each lead
  - single “Schedule Tour” action
- Flow Ops scoreboard:
  - leads parsed
  - qualified leads
  - Tours scheduled
  - same-day Tours
  - inventory covered

Example behavior:

```text
Flow Ops A: Koramangala leads + Koramangala inventory + Koramangala TCMs
Flow Ops B: HSR leads + HSR inventory + HSR TCMs
Flow Ops C: Whitefield leads + Whitefield inventory + Whitefield TCMs
Flow Ops D: BTM/Electronic City leads + matching supply
```

## 3. Area-personalized TCM boards

TCM goal: close every scheduled Tour.

Each TCM should see a board tied to their own zone, properties, and scheduled Tours.

Upgrade TCM dashboard with:

- My Tours today, sorted by hard/medium/soft intent.
- Property win cards:
  - why this property fits the lead
  - available room type
  - price fit
  - objections likely to come up
  - closing script
- “Close this Tour” checklist:
  - confirm arrival
  - show best room
  - handle objection
  - mark outcome
  - book/token/follow-up
- TCM target:
  - Tours assigned
  - show-ups
  - closures
  - lost reasons by property/area

This makes TCMs feel they own a territory and outcome, not just a list.

## 4. HR command layer

HR goal: ensure Flow Ops and TCMs are working together.

Upgrade HR/War Room with:

- Area-by-area operating table:
  - leads available
  - inventory available
  - Tours scheduled
  - TCM capacity
  - bookings
  - leak stage
- People performance by role:
  - Flow Ops: scheduled Tours vs goal
  - TCM: closure/show-up vs goal
  - Owner: inventory freshness and approval speed
- “Where to push today” recommendations:
  - area with supply but not enough leads
  - area with demand but no tours
  - TCM overloaded
  - property owner blocking inventory
- Clear command actions:
  - reassign leads
  - push Flow Ops to schedule
  - push TCM to close
  - ask owner for inventory/photos/price approval

## 5. Owner inventory cockpit

Owner goal: give inventory to the team so everyone can produce results.

Update owner pages so owners see:

- My available rooms/beds.
- Which leads are asking for my area/property.
- How many Tours were scheduled from my inventory.
- What the team needs from me:
  - approve room block
  - update price
  - add photos
  - confirm room availability
- “Managed by Gharpayy” confidence layer:
  - owner feels they own the inventory
  - team visibly manages demand, Tours, and closure.

Also rename owner “Visits” navigation/page wording to “Tours”.

## 6. Pipeline feature

Add a clear pipeline view so nobody loses where the lead is.

Pipeline stages:

```text
New Lead → Parsed → Qualified → Inventory Matched → Options Shared → Tour Scheduled → Tour Done → Booked / Follow-up / Lost
```

Pipeline should support filters by:

- area
- Flow Ops person
- TCM
- property
- lead age
- inventory fit
- duplicate status

This becomes the shared truth for all four roles.

## 7. Geo-intelligence tied to inventory

Implement the Geo-intelligence tab as an operational tool, not just a display.

For every parsed lead:

- pull parsed location
- pull map links
- detect areas/landmarks
- show “distance from lead location to matched inventory”
- show “distance from there to here” for common travel/area comparison
- show confidence:
  - high: map link or known landmark
  - medium: recognized area
  - low: vague/free-text location
- show recommended action:
  - pitch exact area
  - pitch nearby area
  - ask for map pin
  - skip if supply mismatch

## 8. Result-linked Coach

Upgrade Coach so it gives goals, not generic tips.

Coach examples:

- Flow Ops: “You are 3 Tours behind in HSR. These 5 leads match available beds. Schedule now.”
- TCM: “You have 2 hard Tours at Koramangala. Pitch these rooms first; price fit is strong.”
- HR: “Whitefield has 12 available beds but only 2 Tours scheduled. Push Flow Ops.”
- Owner: “Your room has demand but no fresh photos. Upload/approve to unlock more Tours.”

Coach must use supply, inventory, Tours, bookings, and people performance.

## 9. Four-persona testing requirement

Test the module as at least four personas for each role.

Flow Ops personas:

1. High-volume WhatsApp scheduler.
2. New Flow Ops who needs the system to suggest property/TCM.
3. Area owner for Koramangala/HSR.
4. Backlog cleaner handling old/duplicate leads.

TCM personas:

1. Field TCM with many same-day Tours.
2. High closer who should get hard leads.
3. New TCM needing scripts and property fit context.
4. Overloaded TCM who needs capacity protection.

HR personas:

1. Founder/leader checking revenue gap.
2. Team manager checking who is underperforming.
3. Supply-demand controller checking areas.
4. Quality reviewer checking leaks and lost reasons.

Owner personas:

1. Owner with ready inventory.
2. Owner blocking approvals.
3. Owner with low occupancy.
4. Owner needing confidence that Gharpayy is managing everything.

## 10. Technical implementation notes

Likely files/modules to update or add:

- `src/components/leads/QuickAddLeadPanel.tsx`
- `src/myt/pages/ScheduleTour.tsx`
- `src/myt/pages/MYTLeadTracker.tsx`
- `src/myt/pages/FlowOpsDashboard.tsx`
- `src/myt/pages/TCMDashboard.tsx`
- `src/myt/pages/WarRoom.tsx`
- owner pages under `src/owner/pages/*`
- `src/components/AppShell.tsx` for “Tours” terminology and role navigation
- new shared inventory intelligence helper, for example `src/myt/lib/inventory-intelligence.ts`
- new pipeline page/route, for example `src/myt/pages/Pipeline.tsx` and `src/routes/myt/pipeline.tsx`
- coach logic in `src/lib/coach.ts`, `CoachInline`, and `CoachWidget`

Use current local stores/mock data first. No cloud/database tool is required for this pass.

## 11. Validation

After implementation:

- Run TypeScript/build validation.
- Test Quick Add paste → inventory match → duplicate → Tour scheduling.
- Test each role at mobile-ish viewport and desktop.
- Verify “Visits” is replaced with “Tours” in visible UI.
- Walk through the four-role persona checklist and confirm each role has goals, inventory context, and next actions.