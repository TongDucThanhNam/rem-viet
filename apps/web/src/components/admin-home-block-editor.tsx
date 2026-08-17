import {
  CmsBlockEditor,
  createBlockEditorRegistry,
  resolveCmsMediaSelection,
} from "@agency/cms-admin";
import { remVietTemplateBlockLabels as homeBlockLabels } from "@agency/cms-template-rem-viet";
import {
  defaultBenefitsBlock,
  defaultCraftProcessBlock,
  defaultFaqBlock,
  defaultHorizontalGalleryBlock,
  type BentoDetailsBlock,
  type BenefitsBlock,
  type CraftProcessBlock,
  type FaqBlock,
  type FooterCtaBlock,
  type HeroBlock,
  type HomeBlock,
  type HorizontalGalleryBlock,
  type MarqueeBlock,
  type MeasurementGuideBlock,
  type ThreatNarrativeBlock,
} from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import MediaPickerField from "@/components/media-picker-field";

type BlockEditorProps = {
  block: HomeBlock;
  onChange: (block: HomeBlock) => void;
};

type ImageValue = { src: string; alt: string };

const textareaClass =
  "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function createItemId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `${prefix}-${suffix}`;
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function TextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  type = "text",
  helpText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  type?: "text" | "email" | "url";
  helpText?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        maxLength={maxLength}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  maxLength = 600,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
      <textarea
        className={textareaClass}
        id={id}
        maxLength={maxLength}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ImageFields({
  id,
  label,
  value,
  onChange,
  decorative = false,
}: {
  id: string;
  label: string;
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  decorative?: boolean;
}) {
  return (
    <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
      <MediaPickerField
        helpText="Chọn ảnh đã upload từ thư viện media."
        id={`${id}-src`}
        label={label}
        value={value.src}
        onChange={(src) => onChange({ ...value, src })}
        onAssetSelect={(asset) =>
          onChange({
            ...value,
            ...resolveCmsMediaSelection({
              asset,
              currentAlt: value.alt,
              altPolicy: decorative ? "preserve" : "adopt",
            }),
          })
        }
      />
      <TextField
        helpText={
          decorative
            ? "Có thể để trống vì ảnh này chỉ dùng trang trí."
            : "Mô tả ảnh ngắn gọn cho người dùng trình đọc màn hình."
        }
        id={`${id}-alt`}
        label="Alt ảnh"
        maxLength={180}
        value={value.alt}
        onChange={(alt) => onChange({ ...value, alt })}
      />
    </div>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-4 rounded-lg border p-4">
      <legend className="px-2 text-sm font-semibold">{title}</legend>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}

function ArrayItemActions({
  index,
  count,
  minimum,
  maximum,
  onMove,
  onDuplicate,
  onDelete,
}: {
  index: number;
  count: number;
  minimum: number;
  maximum: number;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        aria-label="Di chuyển lên"
        disabled={index === 0}
        size="icon"
        type="button"
        variant="ghost"
        onClick={() => onMove(index - 1)}
      >
        <ChevronUp aria-hidden />
      </Button>
      <Button
        aria-label="Di chuyển xuống"
        disabled={index === count - 1}
        size="icon"
        type="button"
        variant="ghost"
        onClick={() => onMove(index + 1)}
      >
        <ChevronDown aria-hidden />
      </Button>
      <Button
        aria-label="Nhân bản"
        disabled={count >= maximum}
        size="icon"
        type="button"
        variant="ghost"
        onClick={onDuplicate}
      >
        <Copy aria-hidden />
      </Button>
      <Button
        aria-label="Xóa"
        disabled={count <= minimum}
        size="icon"
        type="button"
        variant="ghost"
        onClick={onDelete}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function CtaFields({
  id,
  title,
  value,
  onChange,
}: {
  id: string;
  title: string;
  value: HeroBlock["primaryCta"];
  onChange: (value: HeroBlock["primaryCta"]) => void;
}) {
  return (
    <FieldGroup title={title}>
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          id={`${id}-label`}
          label="Nhãn nút"
          value={value.label}
          onChange={(label) => onChange({ ...value, label })}
        />
        <TextField
          id={`${id}-href`}
          label="Đường dẫn"
          value={value.href}
          onChange={(href) => onChange({ ...value, href })}
        />
        <TextField
          id={`${id}-cursor`}
          label="Nhãn con trỏ"
          value={value.cursorLabel}
          onChange={(cursorLabel) => onChange({ ...value, cursorLabel })}
        />
      </div>
    </FieldGroup>
  );
}

function HeroEditor({
  block,
  onChange,
}: {
  block: HeroBlock;
  onChange: (block: HeroBlock) => void;
}) {
  return (
    <div className="grid gap-5">
      <TextField
        id="hero-kicker"
        label="Nhãn nhỏ"
        maxLength={80}
        value={block.kicker}
        onChange={(kicker) => onChange({ ...block, kicker })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="hero-title-prefix"
          label="Tiêu đề chính"
          maxLength={48}
          value={block.title.prefix}
          onChange={(prefix) =>
            onChange({ ...block, title: { ...block.title, prefix } })
          }
        />
        <TextField
          id="hero-title-accent"
          label="Chữ nhấn italic"
          maxLength={48}
          value={block.title.accent}
          onChange={(accent) =>
            onChange({ ...block, title: { ...block.title, accent } })
          }
        />
      </div>
      <TextAreaField
        id="hero-description"
        label="Mô tả"
        maxLength={360}
        value={block.description}
        onChange={(description) => onChange({ ...block, description })}
      />
      <ImageFields
        decorative
        id="hero-background"
        label="Ảnh nền Hero"
        value={block.background}
        onChange={(background) =>
          onChange({
            ...block,
            background: { ...block.background, ...background },
          })
        }
      />
      <SelectField
        id="hero-position"
        label="Vị trí crop"
        value={block.background.position}
        options={[
          { label: "Giữa", value: "center" },
          { label: "Trái", value: "left" },
          { label: "Phải", value: "right" },
          { label: "Trên", value: "top" },
          { label: "Dưới", value: "bottom" },
        ]}
        onChange={(position) =>
          onChange({ ...block, background: { ...block.background, position } })
        }
      />
      <CtaFields
        id="hero-primary"
        title="Nút chính"
        value={block.primaryCta}
        onChange={(primaryCta) => onChange({ ...block, primaryCta })}
      />
      <CtaFields
        id="hero-secondary"
        title="Nút phụ"
        value={block.secondaryCta}
        onChange={(secondaryCta) => onChange({ ...block, secondaryCta })}
      />
      <FieldGroup
        title="Thanh đặc điểm"
        description="Bốn icon và vị trí được khóa bởi theme; khách chỉ sửa nhãn và nội dung."
      >
        {block.features.map((feature, index) => (
          <div
            className="grid gap-3 border-t pt-4 md:grid-cols-2"
            key={feature.id}
          >
            <TextField
              id={`hero-feature-${feature.id}-label`}
              label={`Đặc điểm ${index + 1}`}
              value={feature.label}
              onChange={(label) =>
                onChange({
                  ...block,
                  features: block.features.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label } : item,
                  ),
                })
              }
            />
            <TextField
              id={`hero-feature-${feature.id}-value`}
              label="Nội dung"
              value={feature.value}
              onChange={(value) =>
                onChange({
                  ...block,
                  features: block.features.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value } : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </FieldGroup>
      <TextField
        id="hero-scroll-label"
        label="Nhãn cuộn"
        value={block.scrollLabel}
        onChange={(scrollLabel) => onChange({ ...block, scrollLabel })}
      />
    </div>
  );
}

function FaqEditor({
  block,
  onChange,
}: {
  block: FaqBlock;
  onChange: (block: FaqBlock) => void;
}) {
  const addItem = () => {
    if (block.items.length >= 20) return;
    const template = defaultFaqBlock.items[0];
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          ...template,
          id: createItemId("faq"),
          question: "Câu hỏi mới",
          answer: "Nhập câu trả lời tại đây.",
        },
      ],
    });
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="faq-eyebrow"
          label="Nhãn nhỏ"
          value={block.eyebrow}
          onChange={(eyebrow) => onChange({ ...block, eyebrow })}
        />
        <TextField
          id="faq-backdrop"
          label="Chữ nền"
          value={block.backdropLabel}
          onChange={(backdropLabel) => onChange({ ...block, backdropLabel })}
        />
      </div>
      <TextField
        id="faq-title"
        label="Tiêu đề"
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
      />
      <TextAreaField
        id="faq-intro"
        label="Đoạn giới thiệu"
        value={block.intro}
        onChange={(intro) => onChange({ ...block, intro })}
      />
      <CtaFields
        id="faq-cta"
        title="Nút tư vấn"
        value={block.cta}
        onChange={(cta) => onChange({ ...block, cta })}
      />

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Danh sách câu hỏi ({block.items.length}/20)
        </h3>
        <Button
          disabled={block.items.length >= 20}
          size="sm"
          type="button"
          variant="secondary"
          onClick={addItem}
        >
          <Plus aria-hidden /> Thêm FAQ
        </Button>
      </div>
      {block.items.map((item, index) => (
        <FieldGroup key={item.id} title={`FAQ ${index + 1}`}>
          <div className="flex justify-end">
            <ArrayItemActions
              count={block.items.length}
              index={index}
              maximum={20}
              minimum={1}
              onMove={(to) =>
                onChange({ ...block, items: moveItem(block.items, index, to) })
              }
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              onDuplicate={() => {
                const next = [...block.items];
                next.splice(index + 1, 0, { ...item, id: createItemId("faq") });
                onChange({ ...block, items: next });
              }}
            />
          </div>
          <TextField
            id={`faq-${item.id}-question`}
            label="Câu hỏi"
            value={item.question}
            onChange={(question) =>
              onChange({
                ...block,
                items: block.items.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, question } : entry,
                ),
              })
            }
          />
          <TextAreaField
            id={`faq-${item.id}-answer`}
            label="Câu trả lời"
            value={item.answer}
            onChange={(answer) =>
              onChange({
                ...block,
                items: block.items.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, answer } : entry,
                ),
              })
            }
          />
        </FieldGroup>
      ))}
    </div>
  );
}

function GalleryEditor({
  block,
  onChange,
}: {
  block: HorizontalGalleryBlock;
  onChange: (block: HorizontalGalleryBlock) => void;
}) {
  const addItem = () => {
    if (block.items.length >= 8) return;
    const template = defaultHorizontalGalleryBlock.items[0];
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          ...template,
          id: createItemId("gallery"),
          image: { ...template.image },
        },
      ],
    });
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="gallery-eyebrow"
          label="Nhãn nhỏ"
          value={block.eyebrow}
          onChange={(eyebrow) => onChange({ ...block, eyebrow })}
        />
        <TextField
          id="gallery-cursor"
          label="Nhãn con trỏ"
          value={block.cursorLabel}
          onChange={(cursorLabel) => onChange({ ...block, cursorLabel })}
        />
      </div>
      <FieldGroup title="Các dòng tiêu đề">
        {block.titleLines.map((line, index) => (
          <div className="flex items-end gap-2" key={`${index}-${line}`}>
            <div className="min-w-0 flex-1">
              <TextField
                id={`gallery-title-line-${index}`}
                label={`Dòng ${index + 1}`}
                value={line}
                onChange={(value) =>
                  onChange({
                    ...block,
                    titleLines: block.titleLines.map((entry, itemIndex) =>
                      itemIndex === index ? value : entry,
                    ),
                  })
                }
              />
            </div>
            <Button
              aria-label="Xóa dòng"
              disabled={block.titleLines.length <= 1}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...block,
                  titleLines: block.titleLines.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          className="justify-self-start"
          disabled={block.titleLines.length >= 3}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({
              ...block,
              titleLines: [...block.titleLines, "Dòng tiêu đề mới"],
            })
          }
        >
          <Plus aria-hidden /> Thêm dòng
        </Button>
      </FieldGroup>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Ảnh gallery ({block.items.length}/8)
        </h3>
        <Button
          disabled={block.items.length >= 8}
          size="sm"
          type="button"
          variant="secondary"
          onClick={addItem}
        >
          <Plus aria-hidden /> Thêm ảnh
        </Button>
      </div>
      {block.items.map((item, index) => (
        <FieldGroup key={item.id} title={`Slide ${index + 1}`}>
          <div className="flex justify-end">
            <ArrayItemActions
              count={block.items.length}
              index={index}
              maximum={8}
              minimum={3}
              onMove={(to) =>
                onChange({ ...block, items: moveItem(block.items, index, to) })
              }
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              onDuplicate={() => {
                const next = [...block.items];
                next.splice(index + 1, 0, {
                  ...item,
                  id: createItemId("gallery"),
                  image: { ...item.image },
                });
                onChange({ ...block, items: next });
              }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id={`gallery-${item.id}-title`}
              label="Tiêu đề"
              value={item.title}
              onChange={(title) =>
                onChange({
                  ...block,
                  items: block.items.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, title } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`gallery-${item.id}-meta`}
              label="Nhãn phụ"
              value={item.meta}
              onChange={(meta) =>
                onChange({
                  ...block,
                  items: block.items.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, meta } : entry,
                  ),
                })
              }
            />
          </div>
          <ImageFields
            id={`gallery-${item.id}`}
            label="Ảnh slide"
            value={item.image}
            onChange={(image) =>
              onChange({
                ...block,
                items: block.items.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, image } : entry,
                ),
              })
            }
          />
        </FieldGroup>
      ))}
    </div>
  );
}

function BenefitsEditor({
  block,
  onChange,
}: {
  block: BenefitsBlock;
  onChange: (block: BenefitsBlock) => void;
}) {
  const addItem = () => {
    if (block.items.length >= 6) return;
    const template = defaultBenefitsBlock.items[0];
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          ...template,
          id: createItemId("benefit"),
          image: { ...template.image },
        },
      ],
    });
  };

  return (
    <div className="grid gap-5">
      <TextField
        id="benefits-eyebrow"
        label="Nhãn nhỏ"
        value={block.eyebrow}
        onChange={(eyebrow) => onChange({ ...block, eyebrow })}
      />
      <TextField
        id="benefits-title"
        label="Tiêu đề"
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
      />
      <TextAreaField
        id="benefits-intro"
        label="Đoạn giới thiệu"
        value={block.intro}
        onChange={(intro) => onChange({ ...block, intro })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="benefits-kicker"
          label="Nhãn trên thẻ"
          value={block.cardKicker}
          onChange={(cardKicker) => onChange({ ...block, cardKicker })}
        />
        <TextField
          id="benefits-cursor"
          label="Nhãn con trỏ"
          value={block.cursorLabel}
          onChange={(cursorLabel) => onChange({ ...block, cursorLabel })}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Lợi ích ({block.items.length}/6)
        </h3>
        <Button
          disabled={block.items.length >= 6}
          size="sm"
          type="button"
          variant="secondary"
          onClick={addItem}
        >
          <Plus aria-hidden /> Thêm lợi ích
        </Button>
      </div>
      {block.items.map((item, index) => (
        <FieldGroup key={item.id} title={`Lợi ích ${index + 1}`}>
          <div className="flex justify-end">
            <ArrayItemActions
              count={block.items.length}
              index={index}
              maximum={6}
              minimum={2}
              onMove={(to) =>
                onChange({ ...block, items: moveItem(block.items, index, to) })
              }
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              onDuplicate={() => {
                const next = [...block.items];
                next.splice(index + 1, 0, {
                  ...item,
                  id: createItemId("benefit"),
                  image: { ...item.image },
                });
                onChange({ ...block, items: next });
              }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id={`benefit-${item.id}-title`}
              label="Tiêu đề"
              value={item.title}
              onChange={(title) =>
                onChange({
                  ...block,
                  items: block.items.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, title } : entry,
                  ),
                })
              }
            />
            <SelectField
              id={`benefit-${item.id}-icon`}
              label="Icon"
              value={item.iconKey}
              options={[
                { label: "Sóng / vật liệu", value: "waves" },
                { label: "Thước đo", value: "ruler" },
                { label: "Lá chắn", value: "shield" },
                { label: "Ngôi nhà", value: "home" },
              ]}
              onChange={(iconKey) =>
                onChange({
                  ...block,
                  items: block.items.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, iconKey } : entry,
                  ),
                })
              }
            />
          </div>
          <TextAreaField
            id={`benefit-${item.id}-description`}
            label="Mô tả"
            value={item.description}
            onChange={(description) =>
              onChange({
                ...block,
                items: block.items.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, description } : entry,
                ),
              })
            }
          />
          <ImageFields
            id={`benefit-${item.id}`}
            label="Ảnh lợi ích"
            value={item.image}
            onChange={(image) =>
              onChange({
                ...block,
                items: block.items.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, image } : entry,
                ),
              })
            }
          />
        </FieldGroup>
      ))}
    </div>
  );
}

function CraftEditor({
  block,
  onChange,
}: {
  block: CraftProcessBlock;
  onChange: (block: CraftProcessBlock) => void;
}) {
  const addItem = () => {
    if (block.steps.length >= 5) return;
    const template = defaultCraftProcessBlock.steps[0];
    onChange({
      ...block,
      steps: [
        ...block.steps,
        {
          ...template,
          id: createItemId("process"),
          image: { ...template.image },
        },
      ],
    });
  };

  return (
    <div className="grid gap-5">
      <TextField
        id="craft-eyebrow"
        label="Nhãn nhỏ"
        value={block.eyebrow}
        onChange={(eyebrow) => onChange({ ...block, eyebrow })}
      />
      <TextField
        id="craft-title"
        label="Tiêu đề"
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
      />
      <TextAreaField
        id="craft-intro"
        label="Đoạn giới thiệu"
        value={block.intro}
        onChange={(intro) => onChange({ ...block, intro })}
      />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Các bước ({block.steps.length}/5)
        </h3>
        <Button
          disabled={block.steps.length >= 5}
          size="sm"
          type="button"
          variant="secondary"
          onClick={addItem}
        >
          <Plus aria-hidden /> Thêm bước
        </Button>
      </div>
      {block.steps.map((step, index) => (
        <FieldGroup key={step.id} title={`Bước ${index + 1}`}>
          <div className="flex justify-end">
            <ArrayItemActions
              count={block.steps.length}
              index={index}
              maximum={5}
              minimum={2}
              onMove={(to) =>
                onChange({ ...block, steps: moveItem(block.steps, index, to) })
              }
              onDelete={() =>
                onChange({
                  ...block,
                  steps: block.steps.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              onDuplicate={() => {
                const next = [...block.steps];
                next.splice(index + 1, 0, {
                  ...step,
                  id: createItemId("process"),
                  image: { ...step.image },
                });
                onChange({ ...block, steps: next });
              }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id={`craft-${step.id}-eyebrow`}
              label="Nhãn bước"
              value={step.eyebrow}
              onChange={(eyebrow) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, eyebrow } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`craft-${step.id}-title`}
              label="Tiêu đề"
              value={step.title}
              onChange={(title) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, title } : entry,
                  ),
                })
              }
            />
          </div>
          <TextAreaField
            id={`craft-${step.id}-description`}
            label="Mô tả"
            value={step.description}
            onChange={(description) =>
              onChange({
                ...block,
                steps: block.steps.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, description } : entry,
                ),
              })
            }
          />
          <ImageFields
            id={`craft-${step.id}`}
            label="Ảnh bước"
            value={step.image}
            onChange={(image) =>
              onChange({
                ...block,
                steps: block.steps.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, image } : entry,
                ),
              })
            }
          />
        </FieldGroup>
      ))}
    </div>
  );
}

function ThreatEditor({
  block,
  onChange,
}: {
  block: ThreatNarrativeBlock;
  onChange: (block: ThreatNarrativeBlock) => void;
}) {
  return (
    <div className="grid gap-5">
      <TextField
        id="threat-scroll"
        label="Nhãn cuộn"
        value={block.scrollLabel}
        onChange={(scrollLabel) => onChange({ ...block, scrollLabel })}
      />
      {block.steps.map((step, index) => (
        <FieldGroup
          key={step.id}
          title={`Chương ${index + 1} · ${step.eyebrow}`}
          description="Ba chương và tone màu được khóa để giữ đúng nhịp animation."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id={`threat-${step.id}-eyebrow`}
              label="Nhãn chương"
              value={step.eyebrow}
              onChange={(eyebrow) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, eyebrow } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`threat-${step.id}-title`}
              label="Tiêu đề"
              value={step.title}
              onChange={(title) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, title } : entry,
                  ),
                })
              }
            />
          </div>
          <TextAreaField
            id={`threat-${step.id}-description`}
            label="Mô tả"
            value={step.description}
            onChange={(description) =>
              onChange({
                ...block,
                steps: block.steps.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, description } : entry,
                ),
              })
            }
          />
          <ImageFields
            id={`threat-${step.id}`}
            label="Ảnh chương"
            value={step.image}
            onChange={(image) =>
              onChange({
                ...block,
                steps: block.steps.map((entry, itemIndex) =>
                  itemIndex === index
                    ? { ...entry, image: { ...entry.image, ...image } }
                    : entry,
                ),
              })
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id={`threat-${step.id}-position`}
              label="Crop desktop"
              value={step.image.position}
              onChange={(position) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, image: { ...entry.image, position } }
                      : entry,
                  ),
                })
              }
            />
            <TextField
              id={`threat-${step.id}-mobile-position`}
              label="Crop mobile"
              value={step.image.mobilePosition}
              onChange={(mobilePosition) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, image: { ...entry.image, mobilePosition } }
                      : entry,
                  ),
                })
              }
            />
          </div>
        </FieldGroup>
      ))}
    </div>
  );
}

function MeasureEditor({
  block,
  onChange,
}: {
  block: MeasurementGuideBlock;
  onChange: (block: MeasurementGuideBlock) => void;
}) {
  return (
    <div className="grid gap-5">
      <TextField
        id="measure-eyebrow"
        label="Nhãn nhỏ"
        value={block.eyebrow}
        onChange={(eyebrow) => onChange({ ...block, eyebrow })}
      />
      <TextField
        id="measure-title"
        label="Tiêu đề"
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
      />
      <TextAreaField
        id="measure-intro"
        label="Đoạn giới thiệu"
        value={block.intro}
        onChange={(intro) => onChange({ ...block, intro })}
      />
      <ImageFields
        id="measure-main"
        label="Ảnh minh họa"
        value={block.image}
        onChange={(image) => onChange({ ...block, image })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="measure-figure-eyebrow"
          label="Nhãn trên ảnh"
          value={block.figureEyebrow}
          onChange={(figureEyebrow) => onChange({ ...block, figureEyebrow })}
        />
        <TextField
          id="measure-idle-label"
          label="Nhãn khi chưa chọn"
          value={block.idleLabel}
          onChange={(idleLabel) => onChange({ ...block, idleLabel })}
        />
      </div>
      <TextField
        id="measure-content-eyebrow"
        label="Nhãn nội dung"
        value={block.contentEyebrow}
        onChange={(contentEyebrow) => onChange({ ...block, contentEyebrow })}
      />
      <TextField
        id="measure-content-title"
        label="Tiêu đề nội dung"
        value={block.contentTitle}
        onChange={(contentTitle) => onChange({ ...block, contentTitle })}
      />
      <TextAreaField
        id="measure-content-description"
        label="Mô tả nội dung"
        value={block.contentDescription}
        onChange={(contentDescription) =>
          onChange({ ...block, contentDescription })
        }
      />
      {block.steps.map((step, index) => (
        <FieldGroup
          key={step.id}
          title={`Bước đo ${index + 1}`}
          description="Ba overlay Rộng, Cao và Ảnh được khóa theo thiết kế."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id={`measure-${step.id}-code`}
              label="Mã"
              value={step.code}
              onChange={(code) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, code } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`measure-${step.id}-short`}
              label="Nhãn ngắn"
              value={step.shortLabel}
              onChange={(shortLabel) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, shortLabel } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`measure-${step.id}-title`}
              label="Tiêu đề"
              value={step.title}
              onChange={(title) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, title } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`measure-${step.id}-overlay`}
              label="Nhãn overlay"
              value={step.overlayLabel}
              onChange={(overlayLabel) =>
                onChange({
                  ...block,
                  steps: block.steps.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, overlayLabel } : entry,
                  ),
                })
              }
            />
          </div>
          <TextAreaField
            id={`measure-${step.id}-description`}
            label="Mô tả"
            value={step.description}
            onChange={(description) =>
              onChange({
                ...block,
                steps: block.steps.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, description } : entry,
                ),
              })
            }
          />
        </FieldGroup>
      ))}
    </div>
  );
}

function BentoEditor({
  block,
  onChange,
}: {
  block: BentoDetailsBlock;
  onChange: (block: BentoDetailsBlock) => void;
}) {
  return (
    <div className="grid gap-5">
      <TextField
        id="bento-eyebrow"
        label="Nhãn nhỏ"
        value={block.eyebrow}
        onChange={(eyebrow) => onChange({ ...block, eyebrow })}
      />
      <TextField
        id="bento-title"
        label="Tiêu đề"
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
      />
      <FieldGroup title="Vật liệu chính">
        <TextField
          id="bento-material-title"
          label="Tiêu đề"
          value={block.material.title}
          onChange={(title) =>
            onChange({ ...block, material: { ...block.material, title } })
          }
        />
        <TextAreaField
          id="bento-material-description"
          label="Mô tả"
          value={block.material.description}
          onChange={(description) =>
            onChange({ ...block, material: { ...block.material, description } })
          }
        />
        <ImageFields
          id="bento-material"
          label="Ảnh vật liệu"
          value={block.material.image}
          onChange={(image) =>
            onChange({ ...block, material: { ...block.material, image } })
          }
        />
      </FieldGroup>
      <FieldGroup
        title="Bốn thông số"
        description="Bốn ô và vị trí được khóa theo bento grid."
      >
        {block.stats.map((stat, index) => (
          <div
            className="grid gap-3 border-t pt-4 md:grid-cols-5"
            key={stat.id}
          >
            <TextField
              id={`bento-stat-${stat.id}-label`}
              label={`Nhãn ${index + 1}`}
              value={stat.label}
              onChange={(label) =>
                onChange({
                  ...block,
                  stats: block.stats.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, label } : entry,
                  ),
                })
              }
            />
            <div className="grid gap-2">
              <Label htmlFor={`bento-stat-${stat.id}-value`}>Giá trị</Label>
              <Input
                id={`bento-stat-${stat.id}-value`}
                inputMode="decimal"
                value={stat.value ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  onChange({
                    ...block,
                    stats: block.stats.map((entry, itemIndex) =>
                      itemIndex === index
                        ? { ...entry, value: raw === "" ? null : Number(raw) }
                        : entry,
                    ),
                  });
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`bento-stat-${stat.id}-decimals`}>Số lẻ</Label>
              <Input
                id={`bento-stat-${stat.id}-decimals`}
                max={2}
                min={0}
                type="number"
                value={stat.decimals}
                onChange={(event) =>
                  onChange({
                    ...block,
                    stats: block.stats.map((entry, itemIndex) =>
                      itemIndex === index
                        ? { ...entry, decimals: Number(event.target.value) }
                        : entry,
                    ),
                  })
                }
              />
            </div>
            <TextField
              id={`bento-stat-${stat.id}-suffix`}
              label="Hậu tố"
              value={stat.suffix}
              onChange={(suffix) =>
                onChange({
                  ...block,
                  stats: block.stats.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, suffix } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`bento-stat-${stat.id}-fallback`}
              label="Chữ thay thế"
              value={stat.fallback}
              onChange={(fallback) =>
                onChange({
                  ...block,
                  stats: block.stats.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, fallback } : entry,
                  ),
                })
              }
            />
          </div>
        ))}
      </FieldGroup>
      <FieldGroup title="Hai điểm nổi bật">
        {block.features.map((feature, index) => (
          <div className="grid gap-3 border-t pt-4" key={feature.id}>
            <TextField
              id={`bento-feature-${feature.id}-title`}
              label={`Tiêu đề ${index + 1}`}
              value={feature.title}
              onChange={(title) =>
                onChange({
                  ...block,
                  features: block.features.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, title } : entry,
                  ),
                })
              }
            />
            <TextAreaField
              id={`bento-feature-${feature.id}-description`}
              label="Mô tả"
              value={feature.description}
              onChange={(description) =>
                onChange({
                  ...block,
                  features: block.features.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, description } : entry,
                  ),
                })
              }
            />
          </div>
        ))}
      </FieldGroup>
      <FieldGroup title="Tiêu chuẩn">
        <TextField
          id="bento-standard-title"
          label="Tiêu đề"
          value={block.standards.title}
          onChange={(title) =>
            onChange({ ...block, standards: { ...block.standards, title } })
          }
        />
        <TextAreaField
          id="bento-standard-description"
          label="Mô tả"
          value={block.standards.description}
          onChange={(description) =>
            onChange({
              ...block,
              standards: { ...block.standards, description },
            })
          }
        />
        <ImageFields
          id="bento-standard"
          label="Ảnh tiêu chuẩn"
          value={block.standards.image}
          onChange={(image) =>
            onChange({ ...block, standards: { ...block.standards, image } })
          }
        />
      </FieldGroup>
    </div>
  );
}

function MarqueeEditor({
  block,
  onChange,
}: {
  block: MarqueeBlock;
  onChange: (block: MarqueeBlock) => void;
}) {
  return (
    <div className="grid gap-5">
      <TextAreaField
        id="marquee-text"
        label="Nội dung chạy"
        maxLength={360}
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
      />
      <TextField
        id="marquee-aria"
        label="Mô tả accessibility"
        value={block.ariaLabel}
        onChange={(ariaLabel) => onChange({ ...block, ariaLabel })}
      />
    </div>
  );
}

function FooterEditor({
  block,
  onChange,
}: {
  block: FooterCtaBlock;
  onChange: (block: FooterCtaBlock) => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="footer-eyebrow"
          label="Nhãn nhỏ"
          value={block.eyebrow}
          onChange={(eyebrow) => onChange({ ...block, eyebrow })}
        />
        <TextField
          id="footer-kicker"
          label="Dòng dẫn"
          value={block.kicker}
          onChange={(kicker) => onChange({ ...block, kicker })}
        />
        <TextField
          id="footer-title-prefix"
          label="Tiêu đề"
          value={block.title.prefix}
          onChange={(prefix) =>
            onChange({ ...block, title: { ...block.title, prefix } })
          }
        />
        <TextField
          id="footer-title-accent"
          label="Phần nhấn"
          value={block.title.accent}
          onChange={(accent) =>
            onChange({ ...block, title: { ...block.title, accent } })
          }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="footer-email"
          label="Email nhận liên hệ"
          type="email"
          value={block.email}
          onChange={(email) => onChange({ ...block, email })}
        />
        <TextField
          id="footer-email-label"
          label="Email hiển thị"
          value={block.emailLabel}
          onChange={(emailLabel) => onChange({ ...block, emailLabel })}
        />
      </div>
      <TextField
        id="footer-cursor"
        label="Nhãn con trỏ CTA"
        value={block.cursorLabel}
        onChange={(cursorLabel) => onChange({ ...block, cursorLabel })}
      />
      <TextField
        id="footer-social-cursor"
        label="Nhãn con trỏ mạng xã hội"
        value={block.socialCursorLabel}
        onChange={(socialCursorLabel) =>
          onChange({ ...block, socialCursorLabel })
        }
      />
      <TextField
        id="footer-copyright"
        label="Bản quyền"
        value={block.copyright}
        onChange={(copyright) => onChange({ ...block, copyright })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="footer-back-label"
          label="Nhãn lên đầu trang"
          value={block.backToTopLabel}
          onChange={(backToTopLabel) => onChange({ ...block, backToTopLabel })}
        />
        <TextField
          id="footer-back-cursor"
          label="Nhãn con trỏ lên đầu"
          value={block.backToTopCursorLabel}
          onChange={(backToTopCursorLabel) =>
            onChange({ ...block, backToTopCursorLabel })
          }
        />
        <TextField
          id="footer-facebook"
          label="Nhãn Facebook"
          value={block.socialLabels.facebook}
          onChange={(facebook) =>
            onChange({
              ...block,
              socialLabels: { ...block.socialLabels, facebook },
            })
          }
        />
        <TextField
          id="footer-shopee"
          label="Nhãn Shopee"
          value={block.socialLabels.shopee}
          onChange={(shopee) =>
            onChange({
              ...block,
              socialLabels: { ...block.socialLabels, shopee },
            })
          }
        />
      </div>
    </div>
  );
}

const homeBlockEditorRegistry = createBlockEditorRegistry<HomeBlock, undefined>(
  {
    hero: { label: homeBlockLabels.hero, Editor: HeroEditor },
    threatNarrative: {
      label: homeBlockLabels.threatNarrative,
      Editor: ThreatEditor,
    },
    marquee: { label: homeBlockLabels.marquee, Editor: MarqueeEditor },
    benefits: { label: homeBlockLabels.benefits, Editor: BenefitsEditor },
    craftProcess: {
      label: homeBlockLabels.craftProcess,
      Editor: CraftEditor,
    },
    bentoDetails: {
      label: homeBlockLabels.bentoDetails,
      Editor: BentoEditor,
    },
    horizontalGallery: {
      label: homeBlockLabels.horizontalGallery,
      Editor: GalleryEditor,
    },
    measurementGuide: {
      label: homeBlockLabels.measurementGuide,
      Editor: MeasureEditor,
    },
    faq: { label: homeBlockLabels.faq, Editor: FaqEditor },
    footerCta: { label: homeBlockLabels.footerCta, Editor: FooterEditor },
  },
);

export default function AdminHomeBlockEditor({
  block,
  onChange,
}: BlockEditorProps) {
  return (
    <CmsBlockEditor
      block={block}
      context={undefined}
      registry={homeBlockEditorRegistry}
      onChange={onChange}
    />
  );
}
