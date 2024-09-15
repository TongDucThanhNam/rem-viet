import React from "react";

interface CloseProps {
  height?: number;
  width?: number;
  size?: number;

  [key: string]: any;
}

export const CloseIcon: React.FC<CloseProps> = ({
  height,
  width,
  size,
  ...props
}) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size || height || 24}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size || width || 24}
      {...props}
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
};
