"use client";

// import CustomButton from "@/components/product/button";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  cn,
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
// @ts-ignore
// import Files from 'react-files'
import { Input } from "@nextui-org/input";
import { Upload } from "react-iconly";
import React, { useEffect, useState } from "react";
import { Button } from "@nextui-org/button";

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
  price: number;
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

//itertools.product
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
        price: 0,
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
      name: product.name,
      description: product.description,
      size: [30, 30, 10],
      price: product.price,
      variants: variantCombinations,
    });

    console.log(jsonString);

    //Gửi dữ liệu lên server
    try {
      const response = await fetch("http://localhost:3001/api/product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonString,
      });

      if (response.ok) {
        console.log("Product saved successfully");
      } else {
        console.error("Failed to save product");
      }
    } catch (error) {
      console.error("Failed to save product", error);
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
                  label={"Image Address"}
                  labelPlacement={"inside"}
                  name={"image-address"}
                  placeholder="Enter image address"
                />
              </CardBody>
            </Card>
          </Tab>
          <Tab key="image_files" title="Tải tệp ảnh">
            <Card>
              <CardBody className={"items-center"}>
                <div
                  className={
                    "flex flex-col rounded-lg p-10 border-2 border-gray-200/20 border-dashed h-[250px] w-[250px]  backdrop-blur-xl bg-default"
                  }
                >
                  <div className={"bg-transparent "}>
                    <div className={"content-center"}>
                      <Upload primaryColor="currentColor" />
                    </div>

                    <div className={"flex flex-col gap-1 "}>
                      <span className={"text-sm"}>
                        Drag and drop an image here or click to upload
                      </span>
                      <span className={"text-sm"}>
                        Image should be at least 500x500px and max 800x800px
                      </span>
                      <input style={{ display: "none" }} type="file" />
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
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
          label={"Product Name"}
          labelPlacement={"inside"}
          name={"product-name"}
          placeholder="Enter product name"
          value={product?.name}
          onValueChange={(value) => {
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
          label={"Description"}
          labelPlacement={"inside"}
          placeholder={"Enter description"}
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
              onChange={() => setIsVariantEnabled(!isVariantEnabled)}
            >
              Enable Variants
            </Switch>
          </CardHeader>
          <CardBody className={"items-start"}>
            <div>
              {variants.map((variant, index) => (
                <div key={index} className={"w-full items-start"}>
                  <p className={"justify-start"}>{variant.name}</p>
                  <div>
                    {variant.values.map((value, subIndex) => (
                      <Chip
                        key={subIndex}
                        aria-label={`Variant Value ${value.value}`}
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
              <CardHeader>Product Variants</CardHeader>
              <CardBody key={"Product Variants add"} className={"items-center"}>
                <Spacer y={1} />
                <Input
                  key={"variantName"}
                  aria-label="Add Variant"
                  className={"max-w-2xl"}
                  label={"Add Variant"}
                  labelPlacement={"inside"}
                  name={"variant-names"}
                  placeholder="Enter product name"
                  value={variantName}
                  onValueChange={(value) => setVariantName(value)}
                />

                <Spacer y={2} />

                {variantValues.map((value, index) => (
                  <>
                    <Input
                      key={`VariantField-${index}`}
                      className={"max-w-2xl"}
                      defaultValue={value.value}
                      label={`Add Variant Values-${index}`}
                      labelPlacement={"inside"}
                      name={`variant-value-${index}`}
                      value={value.value}
                      aria-label={`Variant Value ${index}`}
                      // onChange={(e) => handleChildSubFieldValueChange(e, index)}
                      onValueChange={(value) => {
                        handleChildSubFieldValueChange(value, index);
                      }}
                    />
                    <Spacer y={2} />
                  </>
                ))}

                <Spacer y={1} />

                <Button
                  aria-label="Add Variants"
                  className={"w-fit"}
                  color="primary"
                  onPress={addVariants}
                >
                  Add
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
                emptyContent={"No rows to display."}
                items={variantCombinations}
              >
                {(item) => (
                  <TableRow key={item.key}>
                    <TableCell>
                      <div className={"float-start flex gap-1"}>
                        {Object.keys(item.values).map((key) => (
                          <Chip
                            key={key}
                            aria-label={`Variant Value ${item.values[key]}`}
                            className={
                              "rounded-xl bg-default-100 px-[6px] capitalize text-default-800"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {item.values[key]}
                          </Chip>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell className={""}>
                      <Input
                        key={`price-${item.key}`}
                        aria-label={`price-${item.key}`}
                        className={"w-full"}
                        label={`Price-${item.key}`}
                        labelPlacement={"inside"}
                        name={`price-${item.key}`}
                        placeholder="10000"
                        size={"sm"}
                        tabIndex={item.key}
                        type={"number"}
                        onValueChange={(value) => {
                          //set variant price
                          setVariantCombinations((prevCombinations) => {
                            const updatedCombinations = [
                              ...(prevCombinations || []),
                            ];

                            updatedCombinations[item.key].price =
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
              label={"Price"}
              labelPlacement={"inside"}
              name={"price"}
              placeholder="Price"
              type={"number"}
            />
          </>
        )}

        <Spacer y={5} />

        <Button aria-label="Save Product" onPress={saveProduct}>
          Save product
        </Button>
      </div>

      <Spacer y={10} />
    </div>
  );
}
