import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { ImagePlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import MediaPickerField from "@/components/media-picker-field";

export type CmsPostFormValues = {
  content: string;
  coverImage: string;
  description: string;
  publishDate: string;
  seoDescription: string;
  seoTitle: string;
  slug?: string;
  status: "draft" | "published";
  tags: string[];
  title: string;
};

type CmsPostFormProps = {
  initialValues?: Partial<CmsPostFormValues>;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: CmsPostFormValues) => void;
};

function toTagInput(tags?: string[]) {
  return tags?.join(", ") ?? "";
}

function fromTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function CmsPostForm({
  initialValues,
  isSubmitting = false,
  submitLabel,
  onSubmit,
}: CmsPostFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [coverImage, setCoverImage] = useState(initialValues?.coverImage ?? "");
  const [tags, setTags] = useState(toTagInput(initialValues?.tags));
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    initialValues?.status ?? "draft",
  );
  const [publishDate, setPublishDate] = useState(
    initialValues?.publishDate ?? "",
  );
  const [seoTitle, setSeoTitle] = useState(initialValues?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    initialValues?.seoDescription ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextTitle = title.trim();

    if (!nextTitle) {
      setError("Tiêu đề là bắt buộc.");
      return;
    }

    onSubmit({
      content,
      coverImage: coverImage.trim(),
      description,
      publishDate,
      seoDescription,
      seoTitle,
      slug: slug.trim() || undefined,
      status,
      tags: fromTagInput(tags),
      title: nextTitle,
    });
  }

  return (
    <form className="mx-auto grid w-full max-w-4xl gap-4" onSubmit={submitForm}>
      <Card className="rounded-md">
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="post-title">Tiêu đề</Label>
            <Input
              id="post-title"
              placeholder="Ví dụ: Cách chọn rèm chống muỗi"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="post-slug">Slug</Label>
              <Input
                id="post-slug"
                placeholder="cach-chon-rem-chong-muoi"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="post-status">Trạng thái</Label>
              <select
                className="h-8 rounded-none border border-input bg-background px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                id="post-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "draft" | "published")
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="post-description">Mô tả</Label>
            <textarea
              className="min-h-24 rounded-none border border-input bg-background px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              id="post-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <MediaPickerField
            helpText="Upload ảnh mới hoặc chọn ảnh đã có trong Media."
            id="post-cover"
            label="Cover image"
            value={coverImage}
            onChange={setCoverImage}
          />

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="post-tags">Tags</Label>
              <Input
                id="post-tags"
                placeholder="rèm, chống muỗi, căn hộ"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="post-publish-date">Publish date</Label>
              <Input
                id="post-publish-date"
                placeholder="2026-06-27T09:00:00.000Z"
                value={publishDate}
                onChange={(event) => setPublishDate(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="post-content">Nội dung</Label>
            <textarea
              className="min-h-[28rem] rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              id="post-content"
              placeholder="Markdown/plain text hoặc JSON Notion blocks"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="post-seo-title">SEO title</Label>
            <Input
              id="post-seo-title"
              value={seoTitle}
              onChange={(event) => setSeoTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="post-seo-description">SEO description</Label>
            <textarea
              className="min-h-20 rounded-none border border-input bg-background px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              id="post-seo-description"
              value={seoDescription}
              onChange={(event) => setSeoDescription(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          <ImagePlus aria-hidden />
          {isSubmitting ? "Đang lưu..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
