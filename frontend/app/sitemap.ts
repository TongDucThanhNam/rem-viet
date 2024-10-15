import type { MetadataRoute } from "next"; // export default function sitemap(): MetadataRoute.Sitemap {

type Route = {
  url: string;
  lastModified: string;
};

async function getProductPromise(): Promise<Route[]> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/products/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  const products = data.data;

  return products.map((product: any) => ({
    url: `https://luoichongmuoi.shop/san-pham/${product._id}`,
    lastModified: product.updatedAt, // 2024-10-08
    changeFrequency: "weekly",
    priority: 0.5,
  }));
}

async function getPostPromise(): Promise<Route[]> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/posts`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const posts = await res.json();

  return posts.map((post: any) => ({
    url: `https://luoichongmuoi.shop/bai-viet/${post.slug}.html`,
    lastModified: post.updatedAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
}

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routesMap = [""].map((route) => ({
    url: `https://luoichongmuoi.shop${route}`,
    lastModified: new Date().toISOString(),
  }));

  const productsRoute = await getProductPromise();

  const postsRoute = await getPostPromise();

  let fetchedRoutes: Route[] = [];

  for (const route of productsRoute) {
    fetchedRoutes.push(route);
  }

  for (const route of postsRoute) {
    fetchedRoutes.push(route);
  }

  return [...routesMap, ...fetchedRoutes];
}
