# Landing visual baseline — 2026-08-13

Captured from the local TanStack Start app after the loading timeline completed.
The custom cursor was parked at `(1,1)` before capture.

| Profile | Viewport   | Files           |
| ------- | ---------- | --------------- |
| Desktop | 1440 × 900 | `desktop/*.png` |
| Mobile  | 390 × 844  | `mobile/*.png`  |

Sections: `home`, `threat`, `benefits`, `craft`, `details`, `lifestyle`,
`measure`, `faq`, `order`. The footer baseline uses real repeated scrolling to
the document end because `#order` is a fixed curtain behind `#smooth-wrapper`.

These images are migration guards, not approval that every current visual is
ideal. In particular, the mobile footer baseline records the existing tight
transition from the last FAQ row into the curtain footer. Do not fix unrelated
layout during the CMS content migration without a separate visual decision.

Re-capture a section only after its before/after comparison and reduced-motion
smoke pass are recorded.
