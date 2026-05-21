type LegacyVariant = {
  values?: unknown;
};

type ProductWithVariantsResponse = {
  statusCode?: number;
  data?: {
    variants?: LegacyVariant[];
  } | null;
};

export function legacyHttpStatus(result: { statusCode?: number }) {
  const status = result.statusCode ?? 200;

  return status >= 100 && status <= 599 ? status : 200;
}

export function stringifyLegacyVariantValues<T extends ProductWithVariantsResponse>(
  result: T,
) {
  if (!result.data?.variants) {
    return result;
  }

  return {
    ...result,
    data: {
      ...result.data,
      variants: result.data.variants.map((variant) => ({
        ...variant,
        values:
          typeof variant.values === "string"
            ? variant.values
            : JSON.stringify(variant.values ?? {}),
      })),
    },
  };
}
