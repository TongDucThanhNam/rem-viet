import { useCallback } from "react";
import {
  PatchEvent,
  inc,
  set,
  type InputProps,
  type PatchArg,
  useCurrentUser,
} from "sanity";

const versionedDocumentTypes = new Set(["agencyPage"]);

export function appendPortableVersion(
  change: PatchArg | PatchEvent,
  actorId: string,
) {
  return PatchEvent.from(change).append(
    // Sanity 6.9 emits this supported patch at runtime but accidentally omits
    // FormIncPatch from its exported PatchArg union.
    inc(1, ["version"]) as unknown as PatchArg,
    set(actorId, ["updatedBy"]),
  );
}

export function VersionedDocumentInput(props: InputProps) {
  const currentUser = useCurrentUser();
  const isVersionedDocument =
    props.id === "root" &&
    props.schemaType.type?.name === "document" &&
    versionedDocumentTypes.has(props.schemaType.name);
  const onChange = useCallback<InputProps["onChange"]>(
    (change) =>
      props.onChange(
        appendPortableVersion(change, currentUser?.id ?? "sanity-studio"),
      ),
    [currentUser?.id, props.onChange],
  );

  return props.renderDefault(
    isVersionedDocument ? { ...props, onChange } : props,
  );
}
