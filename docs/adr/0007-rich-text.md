# ADR 0007 — Safe structured rich text

Status: accepted (2026-08-13).

New posts and standard-page rich-text blocks use a versioned JSON document
defined by `richTextDocumentSchema`. The allowlist is paragraph, H2-H4, list,
quote, code, image and video. Text is rendered by React, never injected with
`dangerouslySetInnerHTML`; image alt is mandatory and links/video URLs must
pass URL validation.

Legacy plain text and Notion arrays remain readable during migration. Opening
legacy content in the human editor converts it to the safe v1 format. Pasted
HTML is handled as text, so Google Docs styles cannot enter public markup.
