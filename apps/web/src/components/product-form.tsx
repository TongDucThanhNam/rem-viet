import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { ImagePlus, Trash2, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";

import { FormSection } from "@/components/admin-ui";
import { cloudflareImageUrl } from "@/lib/site-config";
import { normalizeVariantValues } from "@/lib/variants";

export type ProductFormValues = {
  name: string;
  description: string;
  price: string;
  categoryId?: string;
  imageUrls: string[];
  size: string[];
  variants: Array<{
    id?: string;
    _id?: string;
    key: number;
    variantPrice: number;
    values: Record<string, string>;
  }>;
};

type ProductFormProps = {
  initialValues?: Partial<ProductFormValues>;
  isSubmitting?: boolean;
  submitLabel: string;
  categories?: Array<{
    _id: string;
    name: string;
  }>;
  onSubmit: (values: ProductFormValues) => void;
};

type VariantGroup = {
  name: string;
  values: string[];
};

function toLines(values?: string[]) {
  return values?.join("\n") ?? "";
}

function fromLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function signature(values: Record<string, string>) {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function deriveGroups(
  variants?: ProductFormValues["variants"],
): VariantGroup[] {
  const groups = new Map<string, Set<string>>();

  for (const variant of variants ?? []) {
    for (const [name, value] of Object.entries(
      normalizeVariantValues(variant.values),
    )) {
      if (!groups.has(name)) {
        groups.set(name, new Set());
      }
      groups.get(name)?.add(value);
    }
  }

  return Array.from(groups.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}

function generateVariantCombinations(
  groups: VariantGroup[],
  previous: ProductFormValues["variants"],
) {
  const validGroups = groups
    .map((group) => ({
      name: group.name.trim(),
      values: group.values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((group) => group.name && group.values.length);
  const previousPrices = new Map(
    previous.map((variant) => [
      signature(normalizeVariantValues(variant.values)),
      variant.variantPrice,
    ]),
  );
  const previousIds = new Map(
    previous.map((variant) => [
      signature(normalizeVariantValues(variant.values)),
      { id: variant.id, _id: variant._id },
    ]),
  );
  const combinations: ProductFormValues["variants"] = [];

  function backtrack(index: number, values: Record<string, string>) {
    if (index === validGroups.length) {
      combinations.push({
        ...previousIds.get(signature(values)),
        key: combinations.length,
        values,
        variantPrice: previousPrices.get(signature(values)) ?? 0,
      });
      return;
    }

    const group = validGroups[index];
    if (!group) {
      return;
    }

    for (const value of group.values) {
      backtrack(index + 1, {
        ...values,
        [group.name]: value,
      });
    }
  }

  if (validGroups.length) {
    backtrack(0, {});
  }

  return combinations;
}

function variantPriceRange(variants: ProductFormValues["variants"]) {
  const prices = variants
    .map((variant) => Number(variant.variantPrice))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!prices.length) {
    return "0";
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max ? String(min) : `${min} - ${max}`;
}

export default function ProductForm({
  initialValues,
  isSubmitting = false,
  submitLabel,
  categories = [],
  onSubmit,
}: ProductFormProps) {
  const initialVariants = initialValues?.variants ?? [];
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [price, setPrice] = useState(initialValues?.price ?? "");
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrls, setImageUrls] = useState(initialValues?.imageUrls ?? []);
  const [size, setSize] = useState(toLines(initialValues?.size));
  const [isVariantEnabled, setIsVariantEnabled] = useState(
    initialVariants.length > 0,
  );
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>(
    deriveGroups(initialVariants),
  );
  const [variantName, setVariantName] = useState("");
  const [variantValueInputs, setVariantValueInputs] = useState([""]);
  const [variantCombinations, setVariantCombinations] =
    useState<ProductFormValues["variants"]>(initialVariants);
  const [activeImageMode, setActiveImageMode] = useState<"url" | "file">("url");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;
  const normalizedVariantValues = useMemo(
    () => variantValueInputs.map((value) => value.trim()).filter(Boolean),
    [variantValueInputs],
  );

  function syncGroups(groups: VariantGroup[]) {
    setVariantGroups(groups);
    setVariantCombinations((previous) =>
      generateVariantCombinations(groups, previous),
    );
  }

  function addImageUrl() {
    const nextUrl = imageUrl.trim();

    if (!nextUrl) {
      return;
    }

    const normalizedUrl = cloudflareImageUrl(nextUrl) || nextUrl;

    setImageUrls((current) =>
      current.includes(normalizedUrl) ? current : [...current, normalizedUrl],
    );
    setImageUrl("");
  }

  function updateSelectedFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setSelectedFiles((current) => [...current, ...Array.from(fileList)]);
  }

  function removeImage(index: number) {
    setImageUrls((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function addVariantGroup() {
    const nextName = variantName.trim();

    if (!nextName || !normalizedVariantValues.length) {
      setError("Tên biến thể và ít nhất một giá trị là bắt buộc.");
      return;
    }

    const nextGroups = [
      ...variantGroups.filter((group) => group.name !== nextName),
      { name: nextName, values: normalizedVariantValues },
    ];

    setError(null);
    syncGroups(nextGroups);
    setVariantName("");
    setVariantValueInputs([""]);
  }

  function updateVariantValueInput(value: string, index: number) {
    setVariantValueInputs((current) => {
      const nextValues = [...current];

      nextValues[index] = value;

      if (index === current.length - 1 && value.trim()) {
        nextValues.push("");
      }

      return nextValues;
    });
  }

  function removeVariantGroup(nameToRemove: string) {
    syncGroups(variantGroups.filter((group) => group.name !== nameToRemove));
  }

  function updateCombinationPrice(key: number, value: string) {
    setVariantCombinations((current) =>
      current.map((variant) =>
        variant.key === key
          ? { ...variant, variantPrice: Number(value || 0) }
          : variant,
      ),
    );
  }

  async function uploadSelectedFiles() {
    if (!selectedFiles.length) {
      return [];
    }

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/media", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        message?: string;
        data?: Array<{ url?: string }>;
      };

      if (!response.ok) {
        throw new Error(result.message || "Không thể tải ảnh lên kho lưu trữ.");
      }

      return (result.data ?? [])
        .map((item) => item.url)
        .filter((url): url is string => Boolean(url));
    } finally {
      setIsUploading(false);
    }
  }

  async function submitForm() {
    setError(null);

    if (!canSubmit) {
      setError("Tên sản phẩm là bắt buộc.");
      return;
    }

    let uploadedImageUrls: string[] = [];

    try {
      uploadedImageUrls = await uploadSelectedFiles();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải ảnh lên kho lưu trữ.",
      );
      return;
    }

    const nextImageUrls = Array.from(
      new Set([...imageUrls, ...uploadedImageUrls]),
    );

    if (uploadedImageUrls.length) {
      setImageUrls(nextImageUrls);
      setSelectedFiles([]);
    }

    onSubmit({
      name: name.trim(),
      description,
      price: isVariantEnabled ? variantPriceRange(variantCombinations) : price,
      categoryId: categoryId || undefined,
      imageUrls: nextImageUrls,
      size: fromLines(size),
      variants: isVariantEnabled ? variantCombinations : [],
    });
  }

  return (
    <form
      className="mx-auto grid w-full max-w-4xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submitForm();
      }}
    >
      <FormSection
        description="Thêm từ URL hoặc tải tệp lên thư viện media hiện tại."
        title="Hình ảnh"
      >
        <div aria-label="Nguồn ảnh" className="flex w-fit border" role="group">
          {[
            ["url", "Nhập đường dẫn"],
            ["file", "Tải tệp"],
          ].map(([mode, label]) => (
            <Button
              aria-pressed={activeImageMode === mode}
              className="rounded-none border-0"
              key={mode}
              size="sm"
              type="button"
              variant={activeImageMode === mode ? "secondary" : "ghost"}
              onClick={() => setActiveImageMode(mode as "url" | "file")}
            >
              {label}
            </Button>
          ))}
        </div>

        {activeImageMode === "url" ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="image-address">Đường dẫn ảnh</Label>
              <Input
                id="image-address"
                name="image-address"
                placeholder="https://…"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={addImageUrl}>
              <ImagePlus aria-hidden className="size-4" />
              Thêm ảnh
            </Button>
          </div>
        ) : (
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-muted/20 p-5 text-center outline-none focus-within:ring-2 focus-within:ring-ring">
            <UploadCloud aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Chọn tệp ảnh</span>
            <span className="text-xs text-muted-foreground">
              AVIF, GIF, JPEG, PNG hoặc WebP · tối đa 5 MB mỗi ảnh
            </span>
            <Input
              aria-label="Chọn tệp ảnh"
              className="sr-only"
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              multiple
              type="file"
              onChange={(event) => updateSelectedFiles(event.target.files)}
            />
          </label>
        )}

        {selectedFiles.length ? (
          <div className="grid gap-2" aria-label="Tệp chờ tải lên">
            {selectedFiles.map((file, index) => (
              <div
                className="flex min-w-0 items-center gap-3 border p-3 text-xs"
                key={`${file.name}-${file.lastModified}-${index}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
                    {file.type || "image/*"}
                  </p>
                </div>
                <Button
                  aria-label={`Xóa tệp ${file.name}`}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setSelectedFiles((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {imageUrls.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imageUrls.map((url, index) => (
              <div
                className="group relative border p-1"
                key={`${url}-${index}`}
              >
                <img
                  alt={`Ảnh sản phẩm ${index + 1}`}
                  className="aspect-square w-full object-cover"
                  src={url}
                />
                <Button
                  aria-label={`Xóa ảnh ${index + 1}`}
                  className="absolute right-2 top-2"
                  size="icon-sm"
                  type="button"
                  variant="destructive"
                  onClick={() => removeImage(index)}
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </FormSection>

      <FormSection
        description="Tên, mô tả và phân loại hiển thị trong danh mục bán hàng."
        title="Thông tin cơ bản"
      >
        <div className="grid gap-2">
          <Label htmlFor="name">Tên sản phẩm</Label>
          <Input
            id="name"
            name="san-pham-name"
            placeholder="Nhập tên sản phẩm"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Mô tả sản phẩm</Label>
          <Textarea
            className="min-h-28"
            id="description"
            placeholder="Nhập mô tả sản phẩm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="categoryId">Danh mục</Label>
            <select
              className="h-9 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              id="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Chưa phân loại</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="size">Kích thước</Label>
            <Textarea
              className="min-h-20"
              id="size"
              placeholder={"30\n60\n90"}
              value={size}
              onChange={(event) => setSize(event.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        description="Dùng một mức giá hoặc bật biến thể để đặt giá theo tổ hợp thuộc tính."
        title="Giá và biến thể"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border p-3">
          <div>
            <p className="text-sm font-medium">Kích hoạt biến thể</p>
            <p className="text-xs text-muted-foreground">
              Ví dụ: màu sắc, kích thước hoặc chất liệu.
            </p>
          </div>
          <Button
            aria-pressed={isVariantEnabled}
            type="button"
            variant={isVariantEnabled ? "default" : "outline"}
            onClick={() => {
              setIsVariantEnabled((current) => {
                const next = !current;
                if (!next) {
                  setVariantGroups([]);
                  setVariantCombinations([]);
                }
                return next;
              });
            }}
          >
            {isVariantEnabled ? "Đang bật" : "Đang tắt"}
          </Button>
        </div>

        {isVariantEnabled ? (
          <>
            <div className="grid gap-3 border p-3">
              <Label htmlFor="variantName">Thêm nhóm biến thể</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Tên nhóm biến thể"
                  id="variantName"
                  name="variant-names"
                  placeholder="Tên nhóm, ví dụ: Màu"
                  value={variantName}
                  onChange={(event) => setVariantName(event.target.value)}
                />
                <div className="grid gap-2">
                  {variantValueInputs.map((value, index) => (
                    <Input
                      aria-label={`Giá trị biến thể ${index + 1}`}
                      key={`variant-value-${index}`}
                      name={`variant-value-${index}`}
                      placeholder={`Giá trị ${index + 1}`}
                      value={value}
                      onChange={(event) =>
                        updateVariantValueInput(event.target.value, index)
                      }
                    />
                  ))}
                </div>
              </div>
              <Button
                aria-label="Thêm nhóm biến thể"
                className="w-fit"
                type="button"
                variant="outline"
                onClick={addVariantGroup}
              >
                Thêm nhóm
              </Button>
            </div>

            {variantGroups.length ? (
              <div className="grid gap-3">
                {variantGroups.map((group) => (
                  <div
                    className="flex items-start gap-3 border p-3"
                    key={group.name}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{group.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {group.values.join(" · ")}
                      </p>
                    </div>
                    <Button
                      aria-label={`Xóa nhóm ${group.name}`}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={() => removeVariantGroup(group.name)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Giá trị</TableHead>
                    <TableHead className="w-48">Giá</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variantCombinations.length ? (
                    variantCombinations.map((variant) => (
                      <TableRow key={variant.key}>
                        <TableCell>
                          {Object.entries(variant.values)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" · ")}
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`price-${variant.key}`}
                            min="0"
                            name={`price-${variant.key}`}
                            placeholder="10000"
                            type="number"
                            value={String(variant.variantPrice || "")}
                            onChange={(event) =>
                              updateCombinationPrice(
                                variant.key,
                                event.target.value,
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={2}>
                        Thêm ít nhất một nhóm để tạo tổ hợp biến thể.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="product-price">Giá sản phẩm</Label>
            <Input
              aria-label="Giá sản phẩm"
              id="product-price"
              min="0"
              name="san-pham-price"
              placeholder="Nhập giá sản phẩm"
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
        )}
      </FormSection>

      {error ? (
        <div
          className="border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {isUploading
            ? "Đang tải ảnh…"
            : isSubmitting
              ? "Đang lưu sản phẩm…"
              : "Thay đổi chỉ được ghi khi bạn lưu."}
        </p>
        <Button
          aria-label="Lưu sản phẩm"
          disabled={isSubmitting || isUploading || !canSubmit}
          type="submit"
        >
          {isUploading
            ? "Đang tải ảnh…"
            : isSubmitting
              ? "Đang lưu…"
              : submitLabel}
        </Button>
      </div>
    </form>
  );
}
