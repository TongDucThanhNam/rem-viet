import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { ImagePlus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import MediaPickerField from "@/components/media-picker-field";
import CmsRichTextEditor from "@/components/cms-rich-text-editor";
import { FormSection } from "@/components/admin-ui";
import { parseRichTextDocument } from "@rem-viet/cms";
import type { PostRichTextCompositionRequest } from "@/lib/post-rich-text-composition";

export type CmsPostFormValues = {
  content: string;
  coverImage: string;
  description: string;
  publishDate: string;
  seoDescription: string;
  seoTitle: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  slug?: string;
  tags: string[];
  title: string;
};

type CmsPostFormProps = {
  compositionRequest?: PostRichTextCompositionRequest | null;
  contentValue?: string;
  initialValues?: Partial<CmsPostFormValues>;
  isSubmitDisabled?: boolean;
  isSubmitting?: boolean;
  onChange?: (values: CmsPostFormValues, historyGroup?: string) => void;
  selectedBlockIndex?: number | null;
  submitLabel: string;
  status?: ReactNode;
  onSubmit: (values: CmsPostFormValues) => void;
};

type CmsPostFormState = Omit<CmsPostFormValues, "slug" | "tags"> & {
  slug: string;
  tags: string;
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

function initialFormState(
  initialValues?: Partial<CmsPostFormValues>,
): CmsPostFormState {
  return {
    content: initialValues?.content ?? "",
    coverImage: initialValues?.coverImage ?? "",
    description: initialValues?.description ?? "",
    publishDate: initialValues?.publishDate ?? "",
    seoDescription: initialValues?.seoDescription ?? "",
    seoTitle: initialValues?.seoTitle ?? "",
    canonicalUrl: initialValues?.canonicalUrl ?? "",
    ogImage: initialValues?.ogImage ?? "",
    robotsIndex: initialValues?.robotsIndex ?? true,
    robotsFollow: initialValues?.robotsFollow ?? true,
    slug: initialValues?.slug ?? "",
    tags: toTagInput(initialValues?.tags),
    title: initialValues?.title ?? "",
  };
}

function valuesFromState(state: CmsPostFormState): CmsPostFormValues {
  return {
    ...state,
    coverImage: state.coverImage.trim(),
    slug: state.slug.trim() || undefined,
    tags: fromTagInput(state.tags),
    title: state.title.trim(),
  };
}

export function validateCmsPostFormValues(values: CmsPostFormValues) {
  if (!values.title) return "Tiêu đề là bắt buộc.";
  if (!parseRichTextDocument(values.content))
    return "Nội dung có cấu trúc chưa hợp lệ. Kiểm tra văn bản thay thế của ảnh và địa chỉ video.";
  return null;
}

export default function CmsPostForm({
  compositionRequest,
  contentValue,
  initialValues,
  isSubmitDisabled = false,
  isSubmitting = false,
  onChange,
  selectedBlockIndex,
  submitLabel,
  status,
  onSubmit,
}: CmsPostFormProps) {
  const [form, setForm] = useState(() => initialFormState(initialValues));
  const [error, setError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentValue === undefined) return;
    setForm((current) =>
      current.content === contentValue
        ? current
        : { ...current, content: contentValue },
    );
  }, [contentValue]);

  function updateForm(patch: Partial<CmsPostFormState>, historyGroup?: string) {
    const next = { ...form, ...patch };
    setForm(next);
    setError(null);
    onChange?.(valuesFromState(next), historyGroup);
  }

  function submitValues() {
    setError(null);

    const values = valuesFromState(form);
    const validationError = validateCmsPostFormValues(values);
    if (validationError) {
      setError(validationError);
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    onSubmit(values);
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitValues();
  }

  return (
    <form className="mx-auto grid w-full max-w-4xl gap-4" onSubmit={submitForm}>
      {error ? (
        <div
          className="border border-destructive/60 bg-background p-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="post-form-error"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <p className="font-medium">Chưa thể lưu bài viết</p>
          <a
            className="mt-1 inline-block underline underline-offset-2"
            href={error.startsWith("Tiêu đề") ? "#post-title" : "#post-content"}
          >
            {error}
          </a>
        </div>
      ) : null}

      <FormSection
        description="Thông tin nhận diện, lịch xuất bản và ảnh đại diện của bài viết."
        title="Thông tin bài viết"
      >
        <div className="grid gap-2">
          <Label htmlFor="post-title">Tiêu đề</Label>
          <Input
            aria-describedby={
              error?.startsWith("Tiêu đề") ? "post-form-error" : undefined
            }
            aria-invalid={error?.startsWith("Tiêu đề") || undefined}
            id="post-title"
            placeholder="Ví dụ: Cách chọn rèm chống muỗi"
            value={form.title}
            onChange={(event) =>
              updateForm({ title: event.target.value }, "post-field:title")
            }
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="post-slug">Slug</Label>
            <Input
              id="post-slug"
              placeholder="cach-chon-rem-chong-muoi"
              value={form.slug}
              onChange={(event) =>
                updateForm({ slug: event.target.value }, "post-field:slug")
              }
            />
          </div>
          <div className="grid content-end gap-1 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Biểu mẫu này luôn lưu bản nháp đang làm việc. Xuất bản là thao tác
            riêng có xác nhận.
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="post-description">Mô tả</Label>
          <Textarea
            className="min-h-24 text-xs"
            id="post-description"
            value={form.description}
            onChange={(event) =>
              updateForm(
                { description: event.target.value },
                "post-field:description",
              )
            }
          />
        </div>

        <MediaPickerField
          helpText="Tải ảnh mới hoặc chọn ảnh đã có trong thư viện."
          id="post-cover"
          label="Ảnh đại diện"
          value={form.coverImage}
          onChange={(coverImage) =>
            updateForm({ coverImage }, "post-field:cover-image")
          }
        />

        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="post-tags">Thẻ</Label>
            <Input
              id="post-tags"
              placeholder="rèm, chống muỗi, căn hộ"
              value={form.tags}
              onChange={(event) =>
                updateForm({ tags: event.target.value }, "post-field:tags")
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="post-publish-date">Ngày xuất bản</Label>
            <Input
              id="post-publish-date"
              placeholder="2026-06-27T09:00:00.000Z"
              value={form.publishDate}
              onChange={(event) =>
                updateForm(
                  { publishDate: event.target.value },
                  "post-field:publish-date",
                )
              }
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        description="Soạn nội dung có cấu trúc; nội dung dán vào chỉ nhận plain text để tránh mang CSS ngoài vào CMS."
        id="post-content"
        title="Nội dung"
      >
        <div className="grid gap-2">
          <Label>Nội dung</Label>
          <CmsRichTextEditor
            compositionRequest={compositionRequest}
            selectedBlockIndex={selectedBlockIndex}
            value={form.content}
            onChange={(content, historyGroup) =>
              updateForm({ content }, historyGroup)
            }
          />
        </div>
      </FormSection>

      <FormSection
        description="Thiết lập cách bài viết xuất hiện trên công cụ tìm kiếm và mạng xã hội."
        title="SEO và chia sẻ"
      >
        <div className="grid gap-2">
          <Label htmlFor="post-seo-title">Tiêu đề SEO</Label>
          <Input
            id="post-seo-title"
            value={form.seoTitle}
            onChange={(event) =>
              updateForm(
                { seoTitle: event.target.value },
                "post-field:seo-title",
              )
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-canonical">Địa chỉ chính tắc (canonical)</Label>
          <Input
            id="post-canonical"
            placeholder="Để trống để dùng URL mặc định"
            value={form.canonicalUrl}
            onChange={(event) =>
              updateForm(
                { canonicalUrl: event.target.value },
                "post-field:canonical-url",
              )
            }
          />
        </div>
        <MediaPickerField
          id="post-og-image"
          label="Ảnh chia sẻ mạng xã hội"
          value={form.ogImage}
          onChange={(ogImage) => updateForm({ ogImage }, "post-field:og-image")}
          helpText="Để trống để dùng ảnh đại diện."
        />
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.robotsIndex}
              onChange={(event) =>
                updateForm(
                  { robotsIndex: event.target.checked },
                  "post-field:robots-index",
                )
              }
            />
            Cho phép lập chỉ mục
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.robotsFollow}
              onChange={(event) =>
                updateForm(
                  { robotsFollow: event.target.checked },
                  "post-field:robots-follow",
                )
              }
            />
            Cho phép theo liên kết
          </label>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-seo-description">Mô tả SEO</Label>
          <Textarea
            className="min-h-20 text-xs"
            id="post-seo-description"
            value={form.seoDescription}
            onChange={(event) =>
              updateForm(
                { seoDescription: event.target.value },
                "post-field:seo-description",
              )
            }
          />
        </div>
      </FormSection>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div aria-live="polite">{status ?? <span />}</div>
        <Button
          disabled={isSubmitDisabled || isSubmitting}
          onClick={(event) => {
            event.preventDefault();
            submitValues();
          }}
          type="submit"
        >
          <ImagePlus aria-hidden />
          {isSubmitting ? "Đang lưu..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
