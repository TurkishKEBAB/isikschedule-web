**Comparison Target**
- Source visual truth: `docs/design-qa/isik-scheduler-source-1440x840.png`
- Implementation: `docs/design-qa/isik-scheduler-implementation-1440x840.png`
- Route: `/scheduler?file_id=f72b60c0-f733-4804-9f09-8f9ddaa89006&source=QA`
- Viewport: `1440x840`, desktop dark theme
- State: four selected courses, both side panels open, manual draft visible

**Full-View Evidence**
- Source and implementation were combined side by side at their native `1440x840` size.
- The three-column shell, timetable hierarchy, rail density, sticky actions, health strip, and top navigation align closely.
- Source seed data and English copy differ from the runtime QA dataset and Turkish default; these are intentional content differences rather than layout drift.

**Focused Evidence**
- Enlarged side-by-side crops of both rails confirmed control spacing, typography hierarchy, card radii, ECTS meter, dual-range class window, preference controls, and primary action placement.
- A separate center crop was unnecessary because timetable labels, cell fills, split conflicts, and lock affordances were legible in the native full-view comparison.

**Findings**
- No actionable P0, P1, or P2 mismatches remain.
- Fonts and typography: weights, small-label tracking, hierarchy, truncation, and line heights are consistent with the source.
- Spacing and layout rhythm: rail widths, card spacing, grid density, sticky regions, and collapse strips preserve the intended composition.
- Colors and visual tokens: dark surfaces, blue/purple/green course states, amber conflict controls, borders, and muted copy map cleanly to the handoff.
- Image quality and asset fidelity: the supplied IşıkSchedule brand asset remains sharp and correctly scaled; no visible source imagery was replaced by an approximation.
- Copy and content: runtime Turkish labels follow the product default while preserving the source information architecture and control meaning.

**Interaction Checks**
- Left and right rails collapse to `50px` strips, expand again, and the timetable consumes the freed width.
- The Tools popover exposes upload, settings, statistics, shortcuts, clear, export, print, and share actions.
- Locking an occupied slot reconciles the selected course and exposes the locked time in the functional `Kilitli` list.
- Browser console check reported no errors or warnings for the implementation.

**Patches Made Since Previous QA**
- Placed code-group and instructor filters in the source-aligned two-column row.
- Reworked desktop course blocks to use translucent type fills with colored inset edge accents.
- Preserved full-cell sizing and equal conflict splitting while keeping lock controls available over occupied cells.

**Implementation Checklist**
- [x] Match desktop scheduler composition and visual hierarchy.
- [x] Implement collapsible course and build rails.
- [x] Implement functional blocked-times view and occupied-cell locks.
- [x] Add ECTS budget, dual-range class window, and preference help.
- [x] Verify responsive expansion, interaction states, build, lint, type checks, and backend tests.

**Follow-up Polish**
- None required for handoff.

final result: passed
