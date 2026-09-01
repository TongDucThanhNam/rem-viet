import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { Save } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import MediaPickerField from "@/components/media-picker-field";
import CmsRichTextEditor from "@/components/cms-rich-text-editor";
import {
  AdminDisclosure,
  AdminInspector,
  AdminSplitView,
} from "@/components/admin-ui";
import { parseRichTextDocument } from "@rem-viet/cms";

export type CmsPostFormValues = {
  content: string;
  coverImage: string;
  description: string;
  folder: string;
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
  canWrite?: boolean;
  contentValue?: string;
  contentVersion?: number;
  initialValues?: Partial<CmsPostFormValues>;
  isSubmitDisabled?: boolean;
  isSubmitting?: boolean;
  onChange?: (values: CmsPostFormValues, historyGroup?: string) => void;
  onSelectedBlockChange?: (index: number | null) => void;
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
    folder: initialValues?.folder ?? "",
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
  canWrite = true,
  contentValue,
  contentVersion = 0,
  initialValues,
  isSubmitDisabled = false,
  isSubmitting = false,
  onChange,
  onSelectedBlockChange,
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
    <form
      className="mx-auto grid w-full max-w-[92rem] gap-4"
      onSubmit={submitForm}
    >
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
      <AdminSplitView
        className="cms-post-form-layout"
        inspector={
          <AdminInspector>
            <AdminDisclosure defaultOpen title="Thiết lập bài viết">
              <div className="grid gap-4 p-4">
                <MediaPickerField
                  helpText="Ảnh đại diện trong danh sách và khi chia sẻ."
                  id="post-cover"
                  label="Ảnh đại diện"
                  value={form.coverImage}
                  onChange={(coverImage) =>
                    updateForm({ coverImage }, "post-field:cover-image")
                  }
                />
                <div className="grid gap-2">
                  <Label htmlFor="post-slug">Slug</Label>
                  <Input
                    id="post-slug"
                    placeholder="cach-chon-rem-chong-muoi"
                    value={form.slug}
                    onChange={(event) =>
                      updateForm(
                        { slug: event.target.value },
                        "post-field:slug",
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="post-tags">Thẻ</Label>
                  <Input
                    id="post-tags"
                    placeholder="rèm, chống muỗi, căn hộ"
                    value={form.tags}
                    onChange={(event) =>
                      updateForm(
                        { tags: event.target.value },
                        "post-field:tags",
                      )
                    }
                  />
                </div>
                <details className="group/advanced rounded-lg border bg-muted/15 px-3 py-2">
                  <summary className="cursor-pointer list-none text-xs font-medium marker:hidden">
                    Workflow nâng cao
                  </summary>
                  <div className="mt-3 grid gap-3 border-t pt-3">
                    <div className="grid gap-2">
                      <Label htmlFor="post-folder">Thư mục workflow</Label>
                      <Input
                        id="post-folder"
                        placeholder="campaigns/summer"
                        value={form.folder}
                        onChange={(event) =>
                          updateForm(
                            { folder: event.target.value },
                            "post-field:folder",
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="post-publish-date">Ngày nội dung</Label>
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
                </details>
              </div>
            </AdminDisclosure>

            <AdminDisclosure title="SEO và chia sẻ">
              <div className="grid gap-4 p-4">
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
                <div className="grid gap-2">
                  <Label htmlFor="post-canonical">Canonical URL</Label>
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
                  helpText="Để trống để dùng ảnh đại diện."
                  id="post-og-image"
                  label="Ảnh chia sẻ"
                  value={form.ogImage}
                  onChange={(ogImage) =>
                    updateForm({ ogImage }, "post-field:og-image")
                  }
                />
                <div className="grid gap-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      checked={form.robotsIndex}
                      type="checkbox"
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
                      checked={form.robotsFollow}
                      type="checkbox"
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
              </div>
            </AdminDisclosure>

            <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
              <div aria-live="polite">{status ?? <span />}</div>
              <Button
                disabled={isSubmitDisabled || isSubmitting}
                type="submit"
                onClick={(event) => {
                  event.preventDefault();
                  submitValues();
                }}
              >
                <Save aria-hidden />
                {isSubmitting ? "Đang lưu..." : submitLabel}
              </Button>
            </div>
          </AdminInspector>
        }
      >
        <main className="min-w-0">
          <div className="mx-auto grid max-w-4xl gap-3 px-1 pb-5">
            <Label className="sr-only" htmlFor="post-title">
              Tiêu đề
            </Label>
            <Input
              aria-describedby={
                error?.startsWith("Tiêu đề") ? "post-form-error" : undefined
              }
              aria-invalid={error?.startsWith("Tiêu đề") || undefined}
              className="h-auto border-0 bg-transparent px-0 py-2 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-5xl"
              id="post-title"
              placeholder="Tiêu đề bài viết"
              value={form.title}
              onChange={(event) =>
                updateForm({ title: event.target.value }, "post-field:title")
              }
            />
            <Label className="sr-only" htmlFor="post-description">
              Mô tả
            </Label>
            <Textarea
              className="min-h-16 resize-none border-0 bg-transparent px-0 text-base leading-7 text-muted-foreground shadow-none focus-visible:ring-0"
              id="post-description"
              placeholder="Mô tả ngắn giúp người đọc biết bài viết này nói về điều gì…"
              value={form.description}
              onChange={(event) =>
                updateForm(
                  { description: event.target.value },
                  "post-field:description",
                )
              }
            />
          </div>

          <section id="post-content">
            <CmsRichTextEditor
              canWrite={canWrite}
              contentVersion={contentVersion}
              onSelectedBlockChange={onSelectedBlockChange}
              selectedBlockIndex={selectedBlockIndex}
              showOutline
              value={form.content}
              onChange={(content, historyGroup) =>
                updateForm({ content }, historyGroup)
              }
            />
          </section>
        </main>
      </AdminSplitView>
    </form>
  );
}
