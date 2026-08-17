import { openProviders, page } from "./provider-fixture";

const { database, pageProvider, mediaProvider } = await openProviders();
const created = await pageProvider.createDraft({
  id: "upgrade-page",
  content: page("Baseline", "First immutable snapshot"),
  actorId: "upgrade-owner",
});
const first = await pageProvider.publish({
  id: created.id,
  expectedVersion: created.version,
  actorId: "upgrade-owner",
  note: "Baseline publish",
});
const edited = await pageProvider.saveDraft({
  id: created.id,
  expectedVersion: first.document.version,
  content: page("Current", "Second immutable snapshot"),
  actorId: "upgrade-owner",
});
await pageProvider.publish({
  id: created.id,
  expectedVersion: edited.version,
  actorId: "upgrade-owner",
  note: "Current publish",
});
await mediaProvider.upload({
  id: "upgrade-media",
  key: "media/upgrade.png",
  url: "/api/media/media/upgrade.png",
  altText: "Persistent media",
  size: 3,
  mimeType: "image/png",
  body: new Uint8Array([1, 2, 3]),
  actorId: "upgrade-owner",
});
database.close();
console.log(JSON.stringify({ ok: true, revisions: 2, media: 1 }));
