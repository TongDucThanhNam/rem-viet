import { access } from "node:fs/promises";

import { mediaObjectPath, openProviders } from "./provider-fixture";

const { database, pageProvider, mediaProvider } = await openProviders();
const draft = await pageProvider.getDraft({ id: "upgrade-page" });
const published = await pageProvider.getPublished({ slug: "upgrade-page" });
const revisions = await pageProvider.listRevisions("upgrade-page");
const media = await mediaProvider.get("upgrade-media");
await access(mediaObjectPath());
if (
  draft?.content.title !== "Current" ||
  published?.content.title !== "Current" ||
  revisions.length !== 2 ||
  media?.altText !== "Persistent media"
) {
  throw new Error("Provider state did not survive the package transition.");
}
database.close();
console.log(
  JSON.stringify({
    ok: true,
    draftVersion: draft.version,
    publishedRevisionId: published.publishedRevisionId,
    revisions: revisions.length,
    media: media.id,
  }),
);
