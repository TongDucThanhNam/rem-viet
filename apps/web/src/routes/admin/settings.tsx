import type { HomepageSection, MenuItem, SiteSocials } from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import MediaPickerField from "@/components/media-picker-field";
import { getAdminUser } from "@/functions/get-admin-user";
import { siteConfig } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
});

const defaultSocials: SiteSocials = {
  facebook: siteConfig.links.facebook,
  instagram: "",
  shopee: siteConfig.links.shopee,
  youtube: "",
  tiktok: "",
  zalo: siteConfig.links.zalo,
};

const primarySocialKeys = new Set(Object.keys(defaultSocials));

const defaultHomepageSections: HomepageSection[] = [
  { key: "hero", enabled: true, title: "Hero" },
  { key: "benefits", enabled: true, title: "Benefits" },
  { key: "posts", enabled: true, title: "Bài viết" },
];

const defaultMenuItems: MenuItem[] = [
  { label: "Trang chủ", href: "/", order: 0 },
  { label: "Sản phẩm", href: "/danh-sach-san-pham", order: 1 },
  { label: "Bài viết", href: "/bai-viet", order: 2 },
];

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseArray<T>(value: string, label: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} phải là JSON array.`);
  }

  return parsed as T[];
}

function parseObject<T>(value: string, label: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} phải là JSON object.`);
  }

  return parsed as T;
}

function socialValue(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function extraSocials(socials: SiteSocials & Record<string, string>) {
  return Object.fromEntries(
    Object.entries(socials).filter(
      ([key, value]) => !primarySocialKeys.has(key) && value?.trim(),
    ),
  );
}

function AdminSettingsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(trpc.content.siteSettings.get.queryOptions());
  const menusQuery = useQuery(trpc.content.menus.list.queryOptions());
  const [logo, setLogo] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [facebook, setFacebook] = useState(defaultSocials.facebook);
  const [instagram, setInstagram] = useState(defaultSocials.instagram);
  const [shopee, setShopee] = useState(defaultSocials.shopee);
  const [youtube, setYoutube] = useState(defaultSocials.youtube);
  const [tiktok, setTiktok] = useState(defaultSocials.tiktok);
  const [zalo, setZalo] = useState(defaultSocials.zalo);
  const [extraSocialsJson, setExtraSocialsJson] = useState("{}");
  const [homepageSectionsJson, setHomepageSectionsJson] = useState(
    stringify(defaultHomepageSections),
  );
  const [headerMenuJson, setHeaderMenuJson] = useState(
    stringify(defaultMenuItems),
  );
  const [footerMenuJson, setFooterMenuJson] = useState(
    stringify(defaultMenuItems),
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const updateSettings = useMutation(
    trpc.content.siteSettings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.content.siteSettings.get.queryFilter(),
        );
        toast.success("Đã lưu site settings.");
      },
    }),
  );
  const updateMenu = useMutation(
    trpc.content.menus.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.content.menus.list.queryFilter());
        toast.success("Đã lưu menu.");
      },
    }),
  );

  useEffect(() => {
    const settings = settingsQuery.data;

    if (!settings) {
      return;
    }

    setLogo(settings.logo ?? "");
    setPhone(settings.phone ?? "");
    setAddress(settings.address ?? "");
    const socials = settings.socials ?? defaultSocials;
    setFacebook(socialValue(socials.facebook, defaultSocials.facebook));
    setInstagram(socialValue(socials.instagram));
    setShopee(socialValue(socials.shopee, defaultSocials.shopee));
    setYoutube(socialValue(socials.youtube));
    setTiktok(socialValue(socials.tiktok));
    setZalo(socialValue(socials.zalo, defaultSocials.zalo));
    setExtraSocialsJson(stringify(extraSocials(socials)));
    setHomepageSectionsJson(
      stringify(settings.homepageSections ?? defaultHomepageSections),
    );
  }, [settingsQuery.data]);

  useEffect(() => {
    const menus = menusQuery.data ?? [];
    const headerMenu = menus.find((menu) => menu.location === "header");
    const footerMenu = menus.find((menu) => menu.location === "footer");

    if (headerMenu) {
      setHeaderMenuJson(stringify(headerMenu.items ?? []));
    }

    if (footerMenu) {
      setFooterMenuJson(stringify(footerMenu.items ?? []));
    }
  }, [menusQuery.data]);

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError(null);

    try {
      const extra = parseObject<Record<string, string>>(
        extraSocialsJson,
        "Extra socials",
      );

      updateSettings.mutate({
        logo,
        phone,
        address,
        socials: {
          ...extra,
          facebook,
          instagram,
          shopee,
          youtube,
          tiktok,
          zalo,
        },
        homepageSections: parseArray<HomepageSection>(
          homepageSectionsJson,
          "Homepage sections",
        ),
      });
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Settings JSON không hợp lệ.",
      );
    }
  }

  function submitMenus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMenuError(null);

    try {
      const headerItems = parseArray<MenuItem>(headerMenuJson, "Header menu");
      const footerItems = parseArray<MenuItem>(footerMenuJson, "Footer menu");

      updateMenu.mutate({
        location: "header",
        title: "Header menu",
        items: headerItems,
      });
      updateMenu.mutate({
        location: "footer",
        title: "Footer menu",
        items: footerItems,
      });
    } catch (error) {
      setMenuError(
        error instanceof Error ? error.message : "Menu JSON không hợp lệ.",
      );
    }
  }

  return (
    <AdminShell title="Site settings">
      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={submitSettings}>
          <Card className="rounded-md border bg-background">
            <CardHeader>
              <CardTitle>Thông tin site</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <MediaPickerField
                helpText="Logo này được dùng ở header public site."
                id="site-logo"
                label="Logo"
                value={logo}
                onChange={setLogo}
              />
              <div className="grid gap-2">
                <Label htmlFor="site-phone">Phone</Label>
                <Input
                  id="site-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-address">Address</Label>
                <textarea
                  className="min-h-20 rounded-none border border-input bg-background px-2.5 py-2 text-xs outline-none"
                  id="site-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
              <div className="grid gap-4 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Commerce links</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Facebook and Shopee are public customer-facing links.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="social-facebook">Facebook URL</Label>
                    <Input
                      id="social-facebook"
                      placeholder="https://facebook.com/remvina"
                      value={facebook}
                      onChange={(event) => setFacebook(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="social-shopee">Shopee URL</Label>
                    <Input
                      id="social-shopee"
                      placeholder="https://shopee.vn/remvina"
                      value={shopee}
                      onChange={(event) => setShopee(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="social-zalo">Zalo URL</Label>
                    <Input
                      id="social-zalo"
                      placeholder="https://zalo.me/84949491964"
                      value={zalo}
                      onChange={(event) => setZalo(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="social-instagram">Instagram URL</Label>
                    <Input
                      id="social-instagram"
                      value={instagram}
                      onChange={(event) => setInstagram(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="social-youtube">YouTube URL</Label>
                    <Input
                      id="social-youtube"
                      value={youtube}
                      onChange={(event) => setYoutube(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="social-tiktok">TikTok URL</Label>
                    <Input
                      id="social-tiktok"
                      value={tiktok}
                      onChange={(event) => setTiktok(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="extra-socials">Extra socials JSON</Label>
                  <textarea
                    className="min-h-24 rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-6 outline-none"
                    id="extra-socials"
                    value={extraSocialsJson}
                    onChange={(event) => setExtraSocialsJson(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="homepage-sections">Homepage sections JSON</Label>
                <textarea
                  className="min-h-48 rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-6 outline-none"
                  id="homepage-sections"
                  value={homepageSectionsJson}
                  onChange={(event) =>
                    setHomepageSectionsJson(event.target.value)
                  }
                />
              </div>
              {settingsError ? (
                <p className="text-xs text-destructive">{settingsError}</p>
              ) : null}
              <Button disabled={updateSettings.isPending} type="submit">
                <Save aria-hidden />
                Lưu settings
              </Button>
            </CardContent>
          </Card>
        </form>

        <form onSubmit={submitMenus}>
          <Card className="rounded-md border bg-background">
            <CardHeader>
              <CardTitle>Navigation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="header-menu">Header menu JSON</Label>
                <textarea
                  className="min-h-64 rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-6 outline-none"
                  id="header-menu"
                  value={headerMenuJson}
                  onChange={(event) => setHeaderMenuJson(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="footer-menu">Footer menu JSON</Label>
                <textarea
                  className="min-h-64 rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-6 outline-none"
                  id="footer-menu"
                  value={footerMenuJson}
                  onChange={(event) => setFooterMenuJson(event.target.value)}
                />
              </div>
              {menuError ? (
                <p className="text-xs text-destructive">{menuError}</p>
              ) : null}
              <Button disabled={updateMenu.isPending} type="submit">
                <Save aria-hidden />
                Lưu menu
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </AdminShell>
  );
}
