type RemVietLogoProps = {
  alt?: string;
  size?: number;
  src?: string;
};

export default function RemVietLogo({
  alt = siteConfig.name,
  size = 32,
  src = "/src/remviet2.webp",
}: RemVietLogoProps) {
  return (
    <img
      alt={alt}
      className="shrink-0 rounded-full object-cover"
      height={size}
      src={src}
      width={size}
    />
  );
}
import { siteConfig } from "@/lib/site-config";
