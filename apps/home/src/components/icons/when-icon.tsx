import {
  SolarAddSquareBroken,
  SolarBoxLinear,
  SolarMonitorLineDuotone,
  SolarShopLinear,
} from "@/components/icons/icons";

export default function WhenIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "product":
      return <SolarShopLinear />;
    case "order":
      return <SolarBoxLinear />;

    case "manage":
      return <SolarMonitorLineDuotone />;
    case "add":
      return <SolarAddSquareBroken />;
  }
}
