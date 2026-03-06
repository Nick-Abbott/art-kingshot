# Viking Vengeance: Default My Assignment + Standard Instructions

## Problem
Members need fast, unambiguous marching instructions. The current view emphasizes full roster and detailed troop counts, which can slow down execution and increase mistakes.

## Goals
- Make the “My assignment” view the default without hiding the full roster.
- Provide a single, standard set of instructions that never changes.
- Reduce cognitive load by removing non-essential inputs/fields.
- Keep admin and member workflows aligned (same page, different defaults).

## Non-Goals
- Changing the assignment algorithm.
- Adding event scheduling or calendar functionality here.
- Creating per-event custom instructions.

## Proposed UX Changes

### 1) Default Filter = Current Member
- The roster/assignments list is always visible.
- Add a filter control that defaults to the current profile name.
- Provide a clear “Show all” option to remove the filter.
- Persist the filter selection per user (local storage) so it stays on their view.

### 2) Standard Instructions Panel
- A fixed “How to run your marches” panel at the top of the page.
- This content is not editable, always the same, and shown to all users.

### 3) Input Simplification (Recommendation)
- Recommendation: Hide troop count and power by default; keep them accessible under an “Advanced details” disclosure.
- Rationale:
  - The algorithm assumes equalize + march count, not precise troop totals.
  - Most members just need “who to send to.”
  - Admins can still view or update extra details when needed.
- Alternative: remove troop count/power entirely for maximum simplicity.

## Standard Instruction Copy (Fixed)

Title: How to run your marches

Body:
- Use Equalize on every march.
- Send all listed marches exactly to your assigned target(s).
- If you have a garrison leader active, send your main heroes to someone else—ideally someone whose garrison you are leading.
- Do not split or mix targets unless your assignment says to.

Subtext:
- Assignments are calculated assuming equalized marches and consistent march counts.

## Acceptance Criteria
- On page load, the assignments list is filtered to the current profile’s name.
- Users can clear the filter to see the full roster at any time.
- The “How to run your marches” panel appears consistently at the top.
- The instruction copy matches exactly and is not editable.
- Troop count/power fields are hidden by default (advanced toggle) or removed entirely (based on final decision).

## Recommendation on Troop/Power Fields
Best overall: hide behind “Advanced details.”

- Keeps power users satisfied while reducing the main flow to “input march count + follow assignment.”
- Aligns with the algorithm’s assumptions and reduces errors.

If you want maximum simplicity and speed, remove those fields entirely. The downside is losing a place to capture potentially useful data for admin sanity checks.
