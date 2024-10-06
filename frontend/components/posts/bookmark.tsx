import { useEffect, useState } from "react";
import { Card, CardBody, Image, Skeleton } from "@nextui-org/react"; /*
  "title": "American civic leader and educator",
  "description": "",
  "images": [],
  "sitename": [
    "American civic leader and educator"
  ],
  "favicon": "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_favicon_1_32.0Wecxv.png",
  "duration": 2191,
  "domain": "vn.shp.ee",
  "url": "https://vn.shp.ee/HWnrvUQ",
  "source": "jsonlink"
 */

/*
  "title": "American civic leader and educator",
  "description": "",
  "images": [],
  "sitename": [
    "American civic leader and educator"
  ],
  "favicon": "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_favicon_1_32.0Wecxv.png",
  "duration": 2191,
  "domain": "vn.shp.ee",
  "url": "https://vn.shp.ee/HWnrvUQ",
  "source": "jsonlink"
 */

interface BookmarkMetadata {
  title: string;
  description: string;
  images: string[];
  sitename: string[];
  favicon: string;
  duration: number;
  domain: string;
  url: string;
}

async function fetchMetadata(url: string) {
  const apiKey = "pk_f890de2ad1f6b330dab3681d1aff8c3566707bbf";
  const apiUrl = `https://jsonlink.io/api/extract?url=${url}&api_key=${apiKey}`;

  const res = await fetch(apiUrl);
  return await res.json();
}

export default function EnhancedBookmark({
  block,
}: {
  block: { id: string; bookmark: { url: string } };
}) {
  const [metadata, setMetadata] = useState<BookmarkMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = fetchMetadata(block.bookmark.url);
    fetchData.then((data) => {
      console.log("Metadata: ", data);

      setMetadata(data);
      setIsLoading(false);
    });
  }, [block.bookmark.url]);

  return (
    <div key={block.id} className="my-6">
      <Card className="overflow-hidden">
        <a
          href={block.bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col sm:flex-row"
        >
          <div className="relative w-full sm:w-48 h-48">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Image src={metadata?.images[0]} alt={metadata?.title} />
            )}
          </div>
          <CardBody className="flex-1 p-4">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <>
                <div className="flex items-center">
                  <Image
                    src={metadata?.favicon}
                    alt={"favicon"}
                    className="inline-block mr-2"
                  />
                  <h2 className="text-xl font-bold mb-2 line-clamp-2 inline-block">
                    {metadata?.title}
                  </h2>
                </div>
                <p className="text-muted-foreground text-sm mb-2 line-clamp-2">
                  {metadata?.description}
                </p>
              </>
            )}
          </CardBody>
        </a>
      </Card>
    </div>
  );
}
