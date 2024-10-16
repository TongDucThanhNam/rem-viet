"use client";

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  cn,
  Input,
  Spacer,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
} from "@nextui-org/react";
// import Files from 'react-files'
import React, { useEffect, useState } from "react";
import NextImage from "next/image";
import { FileUpload } from "@/components/animations/file-upload";

interface Variant {
  name: string;
  values: VariantValue[];
}

interface VariantValue {
  value: string;
}

interface VariantCombination {
  key: number;
  values: any;
  variantPrice: number;
}

interface Product {
  name: string;
  description: string;
  price: number;
}

const columns = [
  { key: "values", label: "Values" },
  { key: "price", label: "Price" },
];

//itertools.san-pham
function generateVariantCombinations(
  variants: Variant[],
): VariantCombination[] {
  const result: VariantCombination[] = [];
  const variantValues = variants.map((variant) => variant.values);

  function backtrack(
    index: number,
    currentCombination: { [key: string]: string },
  ) {
    if (index === variantValues.length) {
      result.push({
        key: result.length,
        values: currentCombination,
        variantPrice: 0,
      });

      return;
    }

    for (const value of variantValues[index]) {
      const newCombination = { ...currentCombination };

      newCombination[variants[index].name] = value.value;
      backtrack(index + 1, newCombination);
    }
  }

  backtrack(0, {});

  return result;
}

export default function AddProductPage() {
  const [variantValues, setVariantValues] = useState<VariantValue[]>([
    { value: "" },
  ]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [variantCombinations, setVariantCombinations] = useState<
    VariantCombination[]
  >([]);

  const [product, setProduct] = useState<Product>({
    name: "",
    description: "",
    price: 0,
  });

  const [variants, setVariants] = useState<Variant[]>([]);

  const [maxChildIndex, setMaxChildIndex] = useState<number>(0);

  const [variantName, setVariantName] = React.useState("");

  const [isVariantEnabled, setIsVariantEnabled] = React.useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const handleFileUpload = (files: File[]) => {
    setFiles(files);
    console.log(files);
  };

  const addVariants = () => {
    console.log("Before update:", variantValues);

    setVariants((prevVariants) => {
      const updatedVariants = [
        ...prevVariants,
        {
          name: variantName,
          values: variantValues.filter((value) => value.value !== ""),
        },
      ];

      const combinations = generateVariantCombinations(updatedVariants);

      setVariantCombinations(combinations);
      setVariantValues([{ value: "" }]);
      setMaxChildIndex(0);
      setVariantName("");

      return updatedVariants;
    });
  };

  const handleRemoveImage = (index: number) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);

    setImageUrls(newUrls);
  };

  useEffect(() => {
    console.log("After update:", variantValues);
  }, [variantValues]);

  const handleChildSubFieldValueChange = (value: string, index: number) => {
    setVariantValues((prevValues) => {
      const updatedValues = [...prevValues];

      updatedValues[index].value = value;
      if (index === maxChildIndex) {
        updatedValues.splice(index + 1, 0, { value: "" });
        setMaxChildIndex(index + 1);
      }

      return updatedValues;
    });
  };

  const saveProduct = async () => {
    console.log("Save Product");
    const jsonString = JSON.stringify({
      imageurls: imageUrls,
      name: product.name,
      description: product.description,
      size: [30, 30, 10],
      price: product.price,
      variants: variantCombinations,
    });

    console.log(jsonString);

    //Gửi dữ liệu lên server
    try {
      const response = await fetch("/api/add-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonString,
      });

      if (response.ok) {
        console.log("Product saved successfully");
      } else {
        console.error("Failed to save san-pham");
      }
    } catch (error) {
      console.error("Failed to save san-pham", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className=" ">
        <Tabs aria-label="Options">
          <Tab key="image_address" title="Nhập đường dẫn ảnh">
            <Card>
              <CardBody>
                <Input
                  aria-label="Image Address"
                  className={"max-w-2xl"}
                  label={"Đường dẫn ảnh"}
                  labelPlacement={"inside"}
                  name={"image-address"}
                  placeholder={"Nhập đường dẫn ảnh"}
                  value={imageUrl}
                  onValueChange={(value: string) => setImageUrl(value)}
                />
                <Spacer y={1} />

                <Button
                  aria-label="Save Image Address"
                  color={"primary"}
                  fullWidth={false}
                  variant={"shadow"}
                  onPress={() => {
                    setImageUrls((prevUrls) => {
                      setImageUrl("");

                      return [
                        ...prevUrls,
                        `${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${imageUrl}`,
                      ];
                    });
                  }}
                >
                  Thêm ảnh
                </Button>
              </CardBody>
              <CardFooter className={"flex flex-col"}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <NextImage
                        alt={`Preview ${index + 1}`}
                        className="w-full h-40 object-cover rounded-lg"
                        height={40}
                        src={url}
                        width={40}
                      />
                      <Button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        color={"danger"}
                        isIconOnly={true}
                        variant={"shadow"}
                        onClick={() => handleRemoveImage(index)}
                      >
                        X
                      </Button>
                    </div>
                  ))}
                </div>
              </CardFooter>
            </Card>
          </Tab>
          <Tab key="image_files" title="Tải tệp ảnh">
            <FileUpload onChange={handleFileUpload} />
          </Tab>
        </Tabs>
      </div>

      <Spacer y={5} />

      <div
        className={
          "flex flex-col w-full text-center items-center justify-center gap-1 mt-4"
        }
      >
        <Input
          aria-label="Product Name"
          className={"max-w-2xl"}
          label={"Tên sản phẩm"}
          labelPlacement={"inside"}
          name={"san-pham-name"}
          placeholder="Nhập tên sản phẩm"
          value={product?.name}
          onValueChange={(value: string) => {
            setProduct({
              ...product,
              name: value,
            });
          }}
        />

        <Spacer y={1} />

        <Textarea
          aria-label="Product Description"
          className={"max-w-2xl"}
          label={"Mô tả sản phẩm"}
          labelPlacement={"inside"}
          placeholder={"Nhập mô tả sản phẩm"}
          value={product?.description}
          onValueChange={(value) => {
            setProduct({
              ...product,
              description: value,
            });
          }}
        />

        <Spacer y={1} />

        <Card key={"Product Variants"} className={"max-w-2xl"} fullWidth={true}>
          <CardHeader>
            <Switch
              aria-label="Enable Variants"
              isSelected={isVariantEnabled}
              onChange={() => {
                if (isVariantEnabled) {
                  setVariants([]);
                  setVariantCombinations([]);
                  setProduct({
                    ...product,
                    price: 0,
                  });
                }
                setIsVariantEnabled(!isVariantEnabled);
              }}
            >
              Kích hoạt biến thể
            </Switch>
          </CardHeader>
          <CardBody className={"items-start"}>
            <div className="space-y-6">
              {variants.map((variant, index) => (
                <div key={index} className="w-full">
                  <h3 className="text-lg font-semibold mb-2">{variant.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {variant.values.map((value, subIndex) => (
                      <Chip
                        key={subIndex}
                        aria-label={`Variant Value ${value.value}`}
                        className="px-3 py-1 text-sm bg-primary/10 hover:bg-primary/20 transition-colors duration-200"
                      >
                        {value.value}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
          <CardFooter />
        </Card>

        <Spacer y={1} />

        {isVariantEnabled ? (
          <>
            <Card
              key={"Product Variants add"}
              className={"max-w-2xl"}
              fullWidth={true}
            >
              <CardHeader>Thêm biến thể của sản phẩm</CardHeader>
              <CardBody key={"Product Variants add"} className={"items-center"}>
                <Spacer y={1} />
                <Input
                  key={"variantName"}
                  aria-label="Add Variant"
                  className={"max-w-2xl"}
                  label={"Tên biến thể"}
                  labelPlacement={"inside"}
                  name={"variant-names"}
                  placeholder="Nhập tên biến thể"
                  value={variantName}
                  onValueChange={(value: string) => setVariantName(value)}
                />

                <Spacer y={2} />

                {variantValues.map((value, index) => (
                  <>
                    <Input
                      key={`VariantField-${index}`}
                      className={"max-w-2xl"}
                      defaultValue={value.value}
                      label={`Giá biến thể - ${index}`}
                      labelPlacement={"inside"}
                      name={`variant-value-${index}`}
                      value={value.value}
                      aria-label={`Variant Value ${index}`}
                      // onChange={(e) => handleChildSubFieldValueChange(e, index)}
                      onValueChange={(value: string) => {
                        handleChildSubFieldValueChange(value, index);
                      }}
                    />
                    <Spacer y={2} />
                  </>
                ))}

                <Spacer y={1} />

                <Button
                  aria-label="Thêm biến thể"
                  className={"w-fit"}
                  color="primary"
                  onPress={addVariants}
                >
                  Thêm biến thể
                </Button>
              </CardBody>
            </Card>

            <Table
              isCompact
              aria-label="Variant Number"
              className={"max-w-2xl"}
              color={"primary"}
              fullWidth={true}
              layout={"auto"}
              removeWrapper={false}
            >
              <TableHeader className={"flex"} columns={columns}>
                {(column) => (
                  <TableColumn
                    key={column.key}
                    className={cn([
                      column.key === "price"
                        ? "flex-auto w-28"
                        : "flex-auto w-48",
                    ])}
                  >
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody
                emptyContent={"Chưa có biến thể nào."}
                items={variantCombinations}
              >
                {(item) => (
                  <TableRow key={item.key}>
                    <TableCell className={"py-4"}>
                      <div className="flex flex-wrap gap-2 max-w-xs">
                        {Object.entries(item.values)
                          .slice(0, 3)
                          .map(([key, value], index) => (
                            <Chip
                              key={index}
                              aria-label={`Variant ${key}`}
                              className="px-2 py-1 text-sm bg-primary/10 hover:bg-primary/20 transition-colors duration-200"
                            >
                              {`${key}: ${value}`}
                            </Chip>
                          ))}
                      </div>
                    </TableCell>

                    <TableCell className={""}>
                      <Input
                        key={`price-${item.key}`}
                        aria-label={`price-${item.key}`}
                        className={"w-full"}
                        label={`Giá - ${item.key}`}
                        labelPlacement={"inside"}
                        name={`price-${item.key}`}
                        placeholder="10000"
                        size={"sm"}
                        tabIndex={item.key}
                        type={"number"}
                        onValueChange={(value: string) => {
                          //set variant price
                          setVariantCombinations((prevCombinations) => {
                            const updatedCombinations = [
                              ...(prevCombinations || []),
                            ];

                            updatedCombinations[item.key].variantPrice =
                              parseInt(value);

                            return updatedCombinations;
                          });
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        ) : (
          <>
            <Input
              aria-label="Product Price"
              className={"max-w-2xl"}
              label={"Giá"}
              labelPlacement={"inside"}
              name={"price"}
              placeholder="Nhập giá sản phẩm"
              type={"number"}
              onValueChange={(value: string) => {
                setProduct({
                  ...product,
                  price: parseInt(value),
                });
              }}
            />
          </>
        )}

        <Spacer y={5} />

        <Button aria-label="Save Product" onPress={saveProduct}>
          Lưu sản phẩm
        </Button>
      </div>

      <Spacer y={10} />
    </div>
  );
}
