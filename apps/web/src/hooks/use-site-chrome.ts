import { useQuery } from "@tanstack/react-query";

import { getSiteChromeData, type SiteChromeData } from "@/lib/site-chrome";
import { useTRPC } from "@/utils/trpc";

export function useSiteChrome(
  initialData?: SiteChromeData,
  options: { preferInitial?: boolean } = {},
) {
  const trpc = useTRPC();
  const settingsQuery = useQuery({
    ...trpc.content.siteSettings.get.queryOptions(),
    enabled: !options.preferInitial,
  });
  const menusQuery = useQuery({
    ...trpc.content.menus.list.queryOptions(),
    enabled: !options.preferInitial,
  });
  const settings = options.preferInitial
    ? initialData?.settings
    : (settingsQuery.data ?? initialData?.settings);
  const menus =
    (options.preferInitial ? undefined : menusQuery.data) ??
    (initialData
      ? [
          { items: initialData.headerMenu, location: "header" },
          { items: initialData.footerMenu, location: "footer" },
        ]
      : undefined);

  return {
    ...getSiteChromeData(settings, menus),
    isLoading:
      !options.preferInitial &&
      (settingsQuery.isLoading || menusQuery.isLoading),
  };
}
