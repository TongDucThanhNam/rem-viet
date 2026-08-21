# `@agency/cms-module-cache-cloudflare`

Official Cloudflare cache-invalidation module. It converts bounded CMS events
into exact same-origin URL and cache-tag purges, calls only Cloudflare's fixed
zone purge endpoint, keeps credentials server-only, and provides a durable-task
adapter with payload-bound idempotency and retry-safe claim release. Derived
delivery receipts may be deleted on uninstall.
