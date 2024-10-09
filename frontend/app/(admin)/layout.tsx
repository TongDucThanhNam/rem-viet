"use client";

import Sidebar from "@/components/sidebar/sidebar";
import { usePathname } from "next/navigation";

import {
  Avatar,
  Button,
  cn,
  ScrollShadow,
  Spacer,
  Tooltip,
} from "@nextui-org/react";
import React from "react";
import { RemVietIcon } from "@/components/icons/remviet";
import { ThemeSwitch } from "@/components/theme-switch";
import { useTheme } from "next-themes";
import { sectionNestedItems } from "@/config/site";
import {
  SolarInfoCircleLineDuotone,
  SolarMinusCircleLineDuotone,
  SolarSidebarMinimalisticOutline,
} from "@/components/icons/icons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHidden, setIsHidden] = React.useState(false);
  const isCompact = false; // useMediaQuery("(max-width: 768px)");
  const pathname = usePathname();
  const currentPath = pathname.split("/")?.[1];
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <div className="flex h-dvh w-full">
        <div
          className={cn(
            "relative flex h-full w-72 flex-col !border-r-small border-divider p-6 transition-width",
            {
              "-ml-72 -translate-x-72": isHidden && !isCompact,
            },
            {
              "w-16 items-center px-2 py-6": isCompact && !isHidden,
            },
            {
              "-ml-72 -translate-x-72": isHidden && isCompact,
            },
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 px-3",

              {
                "justify-center gap-0": isCompact,
              },
            )}
          >
            <div className="flex items-center justify-center rounded-full bg-foreground">
              <RemVietIcon />
            </div>
            <span
              className={cn("text-small font-bold uppercase opacity-100", {
                "w-0 opacity-0": isCompact,
              })}
            >
              Rèm Việt
            </span>
          </div>
          <Spacer y={8} />
          <div className="flex items-center gap-3 px-3">
            <Avatar isBordered size="sm" src="/src/avatar.webp" />
            <div
              className={cn("flex max-w-full flex-col", { hidden: isCompact })}
            >
              <p className="truncate text-small font-medium text-default-600">
                Nam Tong
              </p>
              <p className="truncate text-tiny text-default-400">
                ADMINISTRATOR
              </p>
            </div>
          </div>
          <ScrollShadow className="-mr-6 h-full max-h-full py-6 pr-6">
            <ScrollShadow className="-mr-6 h-full max-h-full py-6 pr-6">
              <Sidebar
                defaultSelectedKey="home"
                isCompact={isCompact}
                items={sectionNestedItems}
                selectedKeys={[
                  currentPath === "add-san-pham" ? "products" : currentPath,
                ]}
              />
            </ScrollShadow>{" "}
          </ScrollShadow>
          <Spacer y={8} />

          <div className="mt-auto flex flex-col">
            <Tooltip
              content="Dark Mode"
              isDisabled={!isCompact}
              placement="right"
            >
              <Button
                className={cn(
                  "justify-start text-default-500 data-[hover=true]:text-foreground",
                  {
                    "justify-center": isCompact,
                  },
                )}
                isIconOnly={isCompact}
                startContent={isCompact ? null : <ThemeSwitch />}
                variant="light"
                onPress={() => {
                  theme === "light" ? setTheme("dark") : setTheme("light");
                }}
              >
                {isCompact ? <ThemeSwitch /> : "Đổi theme"}
              </Button>
            </Tooltip>

            <Tooltip
              content="Help & Feedback"
              isDisabled={!isCompact}
              placement="right"
            >
              <Button
                fullWidth
                className={cn(
                  "justify-start truncate text-default-500 data-[hover=true]:text-foreground",
                  {
                    "justify-center": isCompact,
                  },
                )}
                isIconOnly={isCompact}
                startContent={
                  isCompact ? null : <SolarInfoCircleLineDuotone width={24} />
                }
                variant="light"
              >
                {isCompact ? (
                  <SolarInfoCircleLineDuotone width={24} />
                ) : (
                  "Trợ giúp"
                )}
              </Button>
            </Tooltip>
            <Tooltip
              content="Log Out"
              isDisabled={!isCompact}
              placement="right"
            >
              <Button
                className={cn(
                  "justify-start text-default-500 data-[hover=true]:text-foreground",
                  {
                    "justify-center": isCompact,
                  },
                )}
                isIconOnly={isCompact}
                startContent={
                  isCompact ? null : <SolarMinusCircleLineDuotone width={24} />
                }
                variant="light"
              >
                {isCompact ? (
                  <SolarMinusCircleLineDuotone width={24} />
                ) : (
                  "Đăng xuất"
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="w-full flex-1 flex-col p-4">
          <header className="flex items-center gap-3 rounded-medium border-small border-divider p-4">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setIsHidden(!isHidden)}
            >
              <SolarSidebarMinimalisticOutline width={24} />
            </Button>
            <h2 className="text-medium font-medium text-default-700">
              Nội dung
            </h2>
          </header>
          <main className="mt-4 h-auto w-full overflow-visible">
            <div className="flex w-full flex-col gap-4 rounded-medium border-small justify-center border-divider">
              <div className={"mb-4"}>{children}</div>
            </div>
          </main>
          <Spacer y={8} />
        </div>
      </div>
    </div>
  );
}
