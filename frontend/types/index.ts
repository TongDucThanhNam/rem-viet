import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  reviewsCount?: number;
  rating?: number;
  soldQuantity?: number;
  // size: string;
  // category: string;
  imageUrl?: string;
  imageUrls?: string[];
  quantity?: number;
  variants?: any;
  // createdAt: string;
  // updatedAt: string;
}
