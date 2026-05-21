export function blankToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

export function booleanStringToBoolean(value: unknown) {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "0"].includes(normalized)) {
      return false;
    }
  }

  return value;
}

export function parsePriceNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const firstPart = value.split(/[-–—]/)[0] ?? "";
  const numericPart = firstPart.match(/\d+/g)?.join("") ?? "";

  return Number(numericPart) || 0;
}

export function normalizeStringRecord(value: unknown) {
  const parsed = typeof value === "string" ? parseJsonObject(value) : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [
      key,
      String(item),
    ]),
  );
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
