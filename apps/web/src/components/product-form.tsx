import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent, CardHeader } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { cn } from "@rem-viet/ui/lib/utils";
import { ImagePlus, Trash2, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";

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
      const response = await fetch("/api/uploads/product-images", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        message?: string;
        data?: Array<{ url?: string }>;
      };

      if (!response.ok) {
        throw new Error(result.message || "Không thể tải ảnh lên storage.");
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
          : "Không thể tải ảnh lên storage.",
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
      className="mx-auto my-14 flex w-full max-w-2xl flex-col items-center justify-center gap-2 px-4 lg:px-0"
      onSubmit={(event) => {
        event.preventDefault();
        submitForm();
      }}
    >
      <div className="w-full">
        <Card className="w-full rounded-lg">
          <CardContent className="grid gap-4">
            <div className="flex w-fit overflow-hidden rounded-md border">
              {[
                ["url", "Nhập đường dẫn ảnh"],
                ["file", "Tải tệp ảnh"],
              ].map(([mode, label]) => (
                <button
                  className={cn(
                    "px-3 py-2 text-xs font-medium",
                    activeImageMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-background",
                  )}
                  key={mode}
                  type="button"
                  onClick={() => setActiveImageMode(mode as "url" | "file")}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeImageMode === "url" ? (
              <div className="grid gap-2">
                <Label htmlFor="image-address">Đường dẫn ảnh</Label>
                <Input
                  aria-label="Image Address"
                  className="h-10"
                  id="image-address"
                  name="image-address"
                  placeholder="Nhập đường dẫn ảnh"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                />
                <Button className="w-fit" type="button" onClick={addImageUrl}>
                  <ImagePlus aria-hidden />
                  Thêm ảnh
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <label className="group/file relative block w-full cursor-pointer overflow-hidden rounded-lg p-10">
                  <div className="absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
                    <div className="flex scale-105 flex-wrap items-center justify-center gap-px bg-gray-100 dark:bg-neutral-900">
                      {Array.from({ length: 120 }).map((_, index) => (
                        <div
                          className={cn(
                            "size-10 shrink-0 rounded-[2px] bg-gray-50 dark:bg-neutral-950",
                            index % 2 === 1 &&
                              "shadow-[0_0_1px_3px_rgba(255,255,255,1)_inset] dark:shadow-[0_0_1px_3px_rgba(0,0,0,1)_inset]",
                          )}
                          key={index}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                    <p className="font-sans text-base font-bold text-neutral-700 dark:text-neutral-300">
                      Tải tệp ảnh
                    </p>
                    <p className="mt-2 max-w-md font-sans text-base font-normal text-neutral-400">
                      Kéo và thả hoặc chọn tệp ảnh
                    </p>
                    <p className="mt-1 max-w-md font-sans text-xs font-normal text-neutral-400">
                      Hình ảnh nên có kích thước 500x500 hoặc 800x800 và dưới
                      5MB
                    </p>
                    <div className="relative mx-auto mt-10 w-full max-w-xl">
                      <div className="relative z-40 mx-auto mt-4 flex h-32 w-full max-w-[8rem] items-center justify-center rounded-md bg-white shadow-[0_10px_50px_rgba(0,0,0,0.1)] transition-transform group-hover/file:-translate-y-5 group-hover/file:translate-x-5 group-hover/file:shadow-2xl dark:bg-neutral-900">
                        <UploadCloud
                          aria-hidden
                          className="size-5 text-neutral-600 dark:text-neutral-300"
                        />
                      </div>
                      <div className="absolute inset-0 z-30 mx-auto mt-4 flex h-32 w-full max-w-[8rem] items-center justify-center rounded-md border border-dashed border-sky-400 bg-transparent opacity-0 transition-opacity group-hover/file:opacity-100" />
                    </div>
                  </div>
                  <Input
                    aria-label="Chọn tệp ảnh"
                    className="sr-only"
                    accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                    multiple
                    type="file"
                    onChange={(event) =>
                      updateSelectedFiles(event.target.files)
                    }
                  />
                </label>

                {selectedFiles.length ? (
                  <div className="grid gap-2 rounded-md border bg-background p-3">
                    {selectedFiles.map((file, index) => (
                      <div
                        className="relative grid gap-2 rounded-md bg-white p-4 pr-12 text-xs shadow-sm dark:bg-neutral-900"
                        key={`${file.name}-${file.lastModified}-${index}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="max-w-xs truncate text-base text-neutral-700 dark:text-neutral-300">
                            {file.name}
                          </p>
                          <p className="shrink-0 rounded-lg px-2 py-1 text-sm text-neutral-600 shadow-sm dark:bg-neutral-800 dark:text-white">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <div className="flex flex-col justify-between gap-2 text-sm text-neutral-600 dark:text-neutral-400 md:flex-row md:items-center">
                          <p className="rounded-md bg-gray-100 px-1 py-0.5 dark:bg-neutral-800">
                            {file.type || "image/*"}
                          </p>
                          <p>
                            Chỉnh sửa lúc{" "}
                            {new Date(file.lastModified).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          aria-label={`Xóa tệp ${file.name}`}
                          className="absolute right-3 top-3 size-7 p-0"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setSelectedFiles((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          <X aria-hidden className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {imageUrls.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {imageUrls.map((url, index) => (
                  <div className="group relative" key={`${url}-${index}`}>
                    <img
                      alt={`Preview ${index + 1}`}
                      className="h-40 w-full rounded-lg object-cover"
                      src={url}
                    />
                    <Button
                      className="absolute right-2 top-2 size-8 p-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
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
          </CardContent>
        </Card>
      </div>

      <div className="h-5" />

      <div className="grid w-full gap-2 text-center">
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

      <div className="h-1" />

      <div className="grid w-full gap-2 text-center">
        <Label htmlFor="description">Mô tả sản phẩm</Label>
        <textarea
          className="min-h-28 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          id="description"
          placeholder="Nhập mô tả sản phẩm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="h-1" />

      <details className="w-full rounded-lg border bg-background">
        <summary className="cursor-pointer px-4 py-3 text-left text-sm font-medium">
          Thông tin mở rộng
        </summary>
        <div className="grid gap-4 border-t p-4">
          <div className="grid w-full gap-2 text-center">
            <Label htmlFor="categoryId">Danh mục</Label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
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

          <div className="grid w-full gap-2 text-center">
            <Label htmlFor="size">Kích thước</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              id="size"
              placeholder="30&#10;30&#10;10"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            />
          </div>
        </div>
      </details>

      <div className="h-1" />

      <Card className="w-full rounded-lg">
        <CardHeader>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <button
              aria-pressed={isVariantEnabled}
              className={cn(
                "h-5 w-9 rounded-full border p-0.5 transition-colors",
                isVariantEnabled ? "bg-primary" : "bg-muted",
              )}
              type="button"
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
              <span
                className={cn(
                  "block size-4 rounded-full bg-background transition-transform",
                  isVariantEnabled && "translate-x-4",
                )}
              />
            </button>
            Kích hoạt biến thể
          </label>
        </CardHeader>
        <CardContent className="grid gap-4">
          {variantGroups.length ? (
            <div className="space-y-6">
              {variantGroups.map((group) => (
                <div className="w-full" key={group.name}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">{group.name}</h3>
                    <Button
                      className="size-7 p-0"
                      type="button"
                      variant="ghost"
                      onClick={() => removeVariantGroup(group.name)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((value) => (
                      <span
                        aria-label={`Variant Value ${value}`}
                        className="bg-primary/10 px-3 py-1 text-sm transition-colors duration-200 hover:bg-primary/20"
                        key={`${group.name}-${value}`}
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="h-1" />

      {isVariantEnabled ? (
        <>
          <Card className="w-full rounded-lg">
            <CardHeader>Thêm biến thể cho sản phẩm</CardHeader>
            <CardContent className="grid gap-4">
              <Input
                aria-label="Add Variant"
                id="variantName"
                name="variant-names"
                placeholder="Nhập tên biến thể"
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
              />

              <div className="grid gap-3">
                {variantValueInputs.map((value, index) => (
                  <Input
                    aria-label={`Variant Value ${index}`}
                    key={`variant-value-${index}`}
                    name={`variant-value-${index}`}
                    placeholder={`Giá trị biến thể - ${index}`}
                    value={value}
                    onChange={(event) =>
                      updateVariantValueInput(event.target.value, index)
                    }
                  />
                ))}
              </div>

              <Button
                aria-label="Add Variants"
                className="w-fit"
                type="button"
                onClick={addVariantGroup}
              >
                Thêm biến thể
              </Button>
            </CardContent>
          </Card>

          <div className="w-full overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="w-2/3 px-4 py-3 font-semibold">Values</th>
                  <th className="w-1/3 px-4 py-3 font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {variantCombinations.length ? (
                  variantCombinations.map((variant) => (
                    <tr className="border-b last:border-b-0" key={variant.key}>
                      <td className="px-4 py-4">
                        <div className="flex max-w-xs flex-wrap gap-2">
                          {Object.entries(variant.values)
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <span
                                aria-label={`Variant ${key}`}
                                className="bg-primary/10 px-2 py-1 text-sm transition-colors duration-200 hover:bg-primary/20"
                                key={`${variant.key}-${key}`}
                              >
                                {key}: {value}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
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
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-muted-foreground"
                      colSpan={2}
                    >
                      Chưa có biến thể để hiển thị.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Input
          aria-label="Product Price"
          name="san-pham-price"
          placeholder="Nhập giá sản phẩm"
          type="number"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      )}

      {error ? (
        <p className="w-full text-xs text-destructive">{error}</p>
      ) : null}

      <div className="h-5" />

      <Button
        aria-label="Save Product"
        className="w-fit"
        disabled={isSubmitting || isUploading || !canSubmit}
        type="submit"
      >
        {isUploading ? "Đang tải ảnh..." : isSubmitting ? "Đang lưu..." : submitLabel}
      </Button>

      <div className="h-10" />
    </form>
  );
}
