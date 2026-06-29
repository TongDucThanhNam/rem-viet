import { useQuery } from "@tanstack/react-query";

import { getSiteChromeData, type SiteChromeData } from "@/lib/site-chrome";
import { useTRPC } from "@/utils/trpc";

export function useSiteChrome(initialData?: SiteChromeData) {
  const trpc = useTRPC();
  const settingsQuery = useQuery(trpc.content.siteSettings.get.queryOptions());
  const menusQuery = useQuery(trpc.content.menus.list.queryOptions());
  const settings = settingsQuery.data ?? initialData?.settings;
  const menus =
    menusQuery.data ??
    (initialData
      ? [
          { items: initialData.headerMenu, location: "header" },
          { items: initialData.footerMenu, location: "footer" },
        ]
      : undefined);

  return {
    ...getSiteChromeData(settings, menus),
    isLoading: settingsQuery.isLoading || menusQuery.isLoading,
  };
}
