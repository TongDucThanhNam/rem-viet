type RemVietLogoProps = {
  size?: number;
};

export default function RemVietLogo({ size = 32 }: RemVietLogoProps) {
  return (
    <img
      alt="Rèm Việt"
      className="shrink-0 rounded-full object-cover"
      height={size}
      src="/src/remviet2.webp"
      width={size}
    />
  );
}
