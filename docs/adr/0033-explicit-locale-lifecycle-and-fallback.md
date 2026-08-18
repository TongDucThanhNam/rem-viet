# ADR 0033: explicit locale lifecycle and fallback

Date: 2026-08-18

## Status

Accepted.

## Context

Collection localization must preserve the existing non-localized lifecycle,
allow translations to be drafted and published independently, and avoid
silently serving the wrong language. Shared fields and relationships also need
deterministic semantics that do not depend on a provider or application guess.

## Decision

A collection opts into localization by declaring a bounded locale list and a
default locale. Every localized provider operation requires a supported locale;
non-localized operations retain the legacy null/empty-locale path. Fields opt
into localization individually. Fields without that marker are shared and are
anchored to the default-locale document.

Draft, schedule, published revision pointer, revision history, restore,
unpublish, and delete state are keyed by collection, document ID, and locale.
A non-default locale can be created only after its default-locale document and
published only after the default locale is published. Deleting the default is
blocked while translations remain.

Read fallback is disabled by default. A caller may explicitly request default
fallback; a fallback result reports the originally requested locale through
`fallbackFrom`. Relationships targeting localized collections declare one of
three policies: resolve in the source locale, resolve in the target default
locale, or accept any target locale.

## Consequences

- Existing rows migrate without behavioral change under the empty locale key.
- Locale variants can move through their lifecycle without changing sibling
  variants.
- Shared data cannot silently diverge across translations.
- Consumers must make fallback and cross-locale relationship intent explicit.
- Admin and API adapters can expose locale state without owning persistence
  rules.
