# Performance and accessibility budgets

Last measured: 2026-08-14 against the production build and live Cloudflare
staging Worker.

## Mechanically enforced artifact budgets

Run:

```bash
bun --cwd apps/web run build
bun run audit:performance
```

The audit is part of root `bun run quality` and fails when an artifact crosses a
hard limit.

| Artifact                 |    Hard limit |           Current | Result |
| ------------------------ | ------------: | ----------------: | ------ |
| Shared application entry |  300 KiB gzip |         132.3 KiB | Pass   |
| About/3D route           |  300 KiB gzip |         280.9 KiB | Pass   |
| Application stylesheet   |   32 KiB gzip |          26.8 KiB | Pass   |
| Individual public raster | 2,048 KiB raw | 1,736 KiB largest | Pass   |

Raster assets over 500 KiB are a review queue, not an automatic failure. Current
queue:

- `7c9323bc-888a-4cba-b876-f0aa79b35158.png` — 1,736 KiB
- `gallery_3.png` — 871 KiB
- `gallery_2.png` — 802 KiB
- `lifestyle_breeze.png` — 790 KiB
- `craft_mesh.png` — 771 KiB
- `invisible_threat.png` — 747 KiB
- `gallery_1.png` — 736 KiB
- `window-mosquito-net-hero.png` — 608 KiB
- `measurement-guide.png` — 601 KiB
- `fiberglass-mesh.png` — 571 KiB

The originals remain for immutable revision and legacy-URL compatibility, so
the artifact audit still reports them. The active flagship CMS revision uses
visually reviewed WebP derivatives: the 1,736 KiB hero is now 58 KiB; the active
gallery/lifestyle/measurement derivatives are 36–155 KiB. New content should
select optimized assets while old published revisions remain recoverable.

## Runtime targets

Measure a real production-like staging deployment with representative data and
record the report URL/version in `docs/cms/execution-ledger.md`:

| Core Web Vital |           Target |
| -------------- | ---------------: |
| LCP            |  <= 2.5 s at p75 |
| CLS            |    <= 0.1 at p75 |
| INP            | <= 200 ms at p75 |

The artifact audit does not prove these runtime targets. Lighthouse/staging and
real-user p75 evidence are still required before the `v1.0.0-client-ready` tag.
Any artifact or runtime metric regression above 10% requires review even when it
remains below the hard limit.

Staging Lighthouse lab evidence on 2026-08-14:

| Profile       | Performance | Accessibility | Best practices | SEO | Modeled LCP | Observed LCP |   CLS |    TBT |
| ------------- | ----------: | ------------: | -------------: | --: | ----------: | -----------: | ----: | -----: |
| Desktop, warm |          88 |           100 |            100 | 100 |      1.52 s |       1.86 s | 0.011 |  63 ms |
| Mobile, warm  |          58 |           100 |            100 | 100 |      7.05 s |       1.47 s | 0.008 | 247 ms |

Across three mobile production traces, observed LCP was 1.45–2.01 seconds. The
large difference between observed and Lighthouse's throttled mobile model is
recorded rather than hidden. Neither value is field p75, and Lighthouse does not
prove INP; representative RUM remains mandatory for the client-ready tag.

## Real-user monitoring and evidence policy

The public application reports only `CLS`, `LCP` and `INP` through the standard
`web-vitals` library. Collection runs on public routes only and skips browsers
that expose `navigator.webdriver`, so CMS use and automated Playwright traffic
do not contaminate release evidence. `RUM_SAMPLE_RATE` is a non-secret number
from `0` to `1`; it defaults to `1` while the flagship gathers its first useful
sample and should be lowered for higher-traffic sites.

Each sampled browser session sends these fields to `POST /api/vitals`:

- schema version and the `web-vitals` generated metric ID;
- metric name, value, rating and navigation type;
- pathname without origin, query string or fragment;
- coarse device class: mobile, tablet or desktop.

The report deliberately excludes IP address, user-agent, cookies, account or
session IDs, query parameters, DOM selectors and attribution entries. The
endpoint requires a same-origin JSON request, limits the body to 2 KiB, validates
the exact schema, deduplicates by metric ID and caps ingestion at 1,000 reports
per metric per minute. D1 retains rows for 90 days; the existing Worker cron
deletes older rows.

Owner/Admin users can open `/admin/performance` to filter by 7/28/90 days,
exact pathname and device class, then download the evidence as JSON. P75 uses
the nearest-rank definition: sort ascending and select
`ceil(0.75 * sampleCount)`. The product evidence policy requires at least 75
samples for **each** metric in the selected slice before it can pass or fail;
this is an agency release policy, not a claim that 75 is a universal industry
minimum. Paths below `/__synthetic__/` are accepted for endpoint smoke but are
always excluded from summaries.

The 2026-08-14 staging rollout applied the `web_vitals` migration and enabled
`RUM_SAMPLE_RATE=1`. A live insert/duplicate/invalid/cross-origin smoke returned
`202/202/400/403`; the accepted row was confirmed in remote D1 and then deleted
by exact synthetic ID/path. A subsequent non-synthetic query returned zero
samples immediately after rollout, so no p75 field claim is recorded yet.

Lighthouse remains the deterministic lab/regression check. RUM becomes release
evidence only after representative real customer traffic exists. Export the
28-day unfiltered JSON, record the deployment/version and traffic context in
`docs/cms/execution-ledger.md`, and do not substitute synthetic requests for
missing field samples.

## Accessibility and responsive gate

Admin critical paths must work by keyboard: login, select/edit block, save,
preview, publish confirmation, media select, lead status and logout. Visible
focus and explicit/native labels are required. Landing animation respects
`prefers-reduced-motion`; coarse/small viewports use the complete static landing
layouts and skip page-wide SplitText/ScrollTrigger measurement. Magnetic/cursor
effects also skip coarse pointers.

Production-artifact Playwright smoke runs desktop 1280x720 and mobile 390x844.
It checks essential landmarks/labels, keyboard reachability and horizontal
overflow. The pinned gallery is the only intentional horizontal animation and
must not expand the page viewport.

The same production-artifact gate runs official `@axe-core/playwright` scans
with WCAG 2.0 A/AA, WCAG 2.1 A/AA, WCAG 2.2 AA and best-practice tags. Required
surfaces are the desktop/mobile public homepage and contact route, authenticated
admin shell and independently loaded private preview. The release threshold is
exactly zero violations; rules may not be disabled or allowlisted to make the
gate pass. Reduced-motion mode must leave all content visible and static before
the scan runs.
