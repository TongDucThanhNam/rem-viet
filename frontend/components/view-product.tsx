"use client";

import {
  Chip,
  cn,
  Snippet,
  Spacer,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react";
import React from "react";

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
  _id?: string;
  imageUrls?: string[];
  name: string;
  description: string;
  price: number;
}

const columns = [
  { key: "values", label: "Values" },
  { key: "price", label: "Price" },
];

export default function ViewProductComponent({
  myProduct,
  myVariants,
  myVariantCombinationArray,
}: {
  myProduct: Product;
  myVariants: Variant[];
  myVariantCombinationArray: VariantCombination[];
}) {
  const imageUrls = myProduct.imageUrls ?? [];

  const variants = myVariants ?? [];

  const isVariantEnabled = !!myVariants;
  return (
    <div className="flex flex-col items-center justify-center">
      {/*Image link snippet row*/}
      <div
        className={
          "flex flex-col w-full items-center justify-center gap-2 mt-4"
        }
      >
        {imageUrls.map((url, index) => (
          <div key={index} className={"flex flex-col items-center"}>
            <Snippet
              hideSymbol={true}
              key={`image-${index}`}
              aria-label={`Image URL ${index}`}
              className={"w-full"}
              tabIndex={index}
            >
              {url}
            </Snippet>
          </div>
        ))}

        <Spacer y={5} />

        {/* Product name */}
        <Snippet
          hideSymbol={true}
          key={"san-pham-name"}
          aria-label={"Product Name"}
          tabIndex={0}
        >
          {myProduct.name}
        </Snippet>

        {/*  Product description */}

        <Snippet
          hideSymbol={true}
          key={"san-pham-description"}
          aria-label={"Product Description"}
          codeString={myProduct.description}
        >
          Mô tả sản phẩm: ...
        </Snippet>

        <Spacer y={1} />

        {variants.map((variant, index) => (
          <div key={index} className={"w-full items-start"}>
            <p className={"justify-start"}>{variant.name}</p>
            {variant.values.map((value, subIndex) => (
              <Snippet
                hideSymbol={true}
                key={subIndex}
                aria-label={`Variant Value ${value.value}`}
              >
                {value.value}
              </Snippet>
            ))}
          </div>
        ))}

        <Spacer y={1} />

        {isVariantEnabled ? (
          <>
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
                        : "flex-auto w-32",
                    ])}
                  >
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody
                emptyContent={"No rows to display."}
                items={myVariantCombinationArray}
              >
                {(item) => (
                  <TableRow key={item.key}>
                    <TableCell className={""}>
                      <div className={"sm:max-w-20 max-w-3xl"}>
                        {Object.keys(item.values).map((key, index) => {
                          if (index < 3) {
                            return (
                              <Chip key={index} aria-label={`Variant ${key}`}>
                                {item.values[key]}
                              </Chip>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </TableCell>

                    <TableCell className={""}>
                      <Snippet
                        key={`price-${item.key}`}
                        aria-label={`price-${item.key}`}
                        className={"w-full"}
                        tabIndex={item.key}
                        hideSymbol={true}
                      >
                        {item.variantPrice}
                      </Snippet>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        ) : (
          <>
            <Snippet aria-label="Product Price" className={"max-w-2xl"}>
              {myProduct.price}
            </Snippet>
          </>
        )}
      </div>
      <Spacer y={10} />
    </div>
  );
}
