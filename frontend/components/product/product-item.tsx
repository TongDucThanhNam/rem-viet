"use client";
import React from "react";
import {
  Accordion,
  AccordionItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  RadioGroup,
  Spacer,
  useDisclosure,
} from "@nextui-org/react";
import { CartIcon } from "@nextui-org/shared-icons";

import { cn } from "@/components/lib/server-utils/utils";
import SizeRadioItem from "@/components/radio/size-radio-item";
import { ExportIcon, PaymentsIcon } from "@/components/icons/icons";
import { Product } from "@/types";
import { priceVietNamDongformetter } from "@/components/lib/client-utils/utils";
import SwiperThumbnail from "@/components/product/product-thumbnail";

interface ProductItemProps {
  product: any;
  variants: any;
  isLoading: boolean;
  addToCart: any;
}

const skeletonImageUrls = Array(5).fill("/src/800x800.png");

const ProductItem: React.FC<ProductItemProps> = ({
  product,
  variants,
  isLoading,
  addToCart,
}) => {
  const basePrice = product.price.toString();

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [variantChosen, setVariantChosen] = React.useState<any>([]);
  //san-pham price
  const [productPrice, setProductPrice] = React.useState<string>(
    product.price.toString(),
  );

  const [isVariantChosen, setIsVariantChosen] = React.useState<boolean>(false);

  //preprocess variants
  let preProcessingVariant: { [key: string]: string[] } = {};

  for (const variant of variants) {
    let values;

    // Check if variant.values is a string
    if (typeof variant.values === "string") {
      // Parse the JSON string into an object
      values = JSON.parse(variant.values);
    } else {
      // Use the object directly
      values = variant.values;
    }

    for (const key in values) {
      if (preProcessingVariant[key] === undefined) {
        preProcessingVariant[key] = [];
      }

      if (!preProcessingVariant[key].includes(values[key])) {
        preProcessingVariant[key].push(values[key]);
      }
    }
  }

  //update price when variant change
  React.useEffect(() => {
    //Log
    console.log("Variant chosen: ", variantChosen);

    //not selected any variant
    if (Object.keys(variantChosen).length === 0) {
      console.log("No variant chosen");
      // san-pham.price = basePrice;
      setProductPrice(basePrice);
      setIsVariantChosen(false);

      return;
    }

    //Update price
    for (const variant of variants) {
      let values;

      // Check if variant.values is a string
      if (typeof variant.values === "string") {
        // Parse the JSON string into an object
        values = JSON.parse(variant.values);
      } else {
        // Use the object directly
        values = variant.values;
      }

      if (areObjectsEqual(values, variantChosen)) {
        console.log("Found variant: ", variant);
        setProductPrice(variant.variantPrice);
        // san-pham.price = variant.price;
        setIsVariantChosen(true);

        return;
      }
    }

    //set new price
    // san-pham.price = price;
  }, [variantChosen]);

  //Compare 2 objects
  function areObjectsEqual(obj1: any, obj2: any): boolean {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }

    return true;
  }

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    console.log("Form data: ", data);

    const body = {
      variantChosen: variantChosen,
      product: product,
      productPrice: productPrice,
      info: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.address,
        specificAddress: data.specificAddress,
        district: data.district,
        city: data.city,
        postcode: data.postcode,
        phoneNumber: data.phoneNumber,
      },
    };

    // console.log("Body: ", body);

    try {
      const response = await fetch("/api/send-product-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      isOpen && onOpenChange();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="">
      <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        {/*Big image*/}

        <div className="relative h-full w-full flex-none">
          {isLoading ? (
            <SwiperThumbnail
              imageUrls={skeletonImageUrls}
              isLoading={isLoading}
            />
          ) : (
            <SwiperThumbnail
              imageUrls={product.imageUrls}
              isLoading={isLoading}
            />
          )}
        </div>

        {/*Details*/}
        <div className="flex flex-col">
          <h1 className="inline bg-gradient-to-br from-foreground-800 to-foreground-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            {product.name}
          </h1>
          {/*Price*/}
          <p className="text-xl font-medium tracking-tight">
            {priceVietNamDongformetter(productPrice)}
          </p>

          {/*Ratings*/}
          <div className="class=my-2 flex items-center gap-2">
            <span>⭐⭐⭐⭐⭐</span>
            <span className="">5 lượt đánh giá</span>
          </div>

          <Spacer y={3} />

          <Spacer y={3} />

          {/*Variants*/}
          {Object.keys(preProcessingVariant).map((key, index) => (
            <div key={index} className="flex flex-col gap-2">
              <p className="text-lg font-semibold">{key}</p>
              <RadioGroup
                classNames={{
                  base: cn("", "max-w-fit"),
                  wrapper: cn("", "gap-3"),
                }}
                defaultValue="1"
                orientation="horizontal"
                size="lg"
                value={variantChosen[key]}
                onValueChange={(value) => {
                  setVariantChosen({ ...variantChosen, [key]: value });
                }}
              >
                {preProcessingVariant[key].map(
                  (value: string, index: number) => (
                    <SizeRadioItem key={index} value={value} />
                  ),
                )}
              </RadioGroup>
            </div>
          ))}

          <Spacer y={3} />

          <Accordion className={""} selectionMode="multiple" variant="bordered">
            <AccordionItem
              key="0"
              aria-label="Payments"
              className={""}
              subtitle={
                <p className="line-clamp-3 text-medium ">
                  {product.description}
                </p>
              }
              title="Mô tả sản phẩm"
            >
              <p className="text-medium ">{product.description}</p>
            </AccordionItem>

            <AccordionItem
              key="1"
              aria-label="Payments"
              className={""}
              startContent={<PaymentsIcon />}
              title="Thanh thoán và trả hàng"
            >
              {/*    List has dot in start*/}
              <ul className="list-disc list-inside">
                <li>Bạn chỉ phải trả tiền khi sản phẩm đúng với mô tả</li>
                <li>Bạn có thể trả hàng trong vòng 3 ngày</li>
              </ul>
            </AccordionItem>
            <AccordionItem
              key="2"
              aria-label="Receipt"
              startContent={<ExportIcon />}
              title="Hoá đơn và bảo hành"
            >
              {/*    List has dot in start*/}
              <ul className="list-disc list-inside">
                <li>Chúng tôi có thể gửi hoá đơn đến email cho bạn</li>
              </ul>
            </AccordionItem>
          </Accordion>

          <div className="mt-2 flex gap-2">
            <Button
              className={""}
              color={"primary"}
              startContent={<PaymentsIcon />}
              onPress={onOpen}
            >
              Mua ngay
            </Button>
            <Button
              className={""}
              color={"secondary"}
              isDisabled={!isVariantChosen}
              startContent={<CartIcon />}
              onClick={() => {
                const selectedCartItems: Product = {
                  id: product._id,
                  name: product.name,
                  price: parseFloat(productPrice) ?? 0,
                  imageUrl: product.imageUrls[0],
                  quantity: 1,
                  description: product.description,
                  variants: variantChosen,
                };

                console.log("Add to cart");
                addToCart(selectedCartItems);
              }}
            >
              Thêm vào giỏ hàng
            </Button>
          </div>
        </div>
      </div>

      <Modal
        backdrop={"blur"}
        classNames={{
          wrapper: "",
          body: "",
          backdrop: "",
          base: "h-screen",
          header: "",
          footer: "",
          closeButton: "",
        }}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
        isOpen={isOpen}
        placement={"bottom-center"}
        scrollBehavior={"inside"}
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <form
                className="flex flex-col gap-5 py-8"
                onSubmit={handlePurchase}
              >
                <ModalHeader>Thanh toán</ModalHeader>
                <ModalBody className={"h-fit"}>
                  {/*Email*/}
                  <div className="group flex flex-col w-full group relative justify-end">
                    <Input
                      id={"email"}
                      label="Email của bạn"
                      labelPlacement="outside"
                      name={"email"}
                      placeholder="Nhập Email của bạn"
                    />
                  </div>

                  {/*Name*/}
                  <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                    {/*First Name*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        required
                        id={"firstName"}
                        isRequired={true}
                        label="Họ của bạn"
                        labelPlacement="outside"
                        name={"firstName"}
                        placeholder="Nhập họ của bạn"
                      />
                    </div>

                    {/*Last Name*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        required
                        id={"lastName"}
                        label="Tên của bạn"
                        labelPlacement="outside"
                        name={"lastName"}
                        placeholder="Nhập tên của bạn"
                      />
                    </div>
                  </div>

                  {/*Address*/}
                  <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                    {/*Address*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        required
                        id={"address"}
                        label="Địa chỉ"
                        labelPlacement="outside"
                        name={"address"}
                        placeholder="Lê Văn Lương, Quận 7, TP.HCM"
                      />
                    </div>

                    {/*Specific address*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        isRequired
                        id={"specificAddress"}
                        label="Specific address"
                        labelPlacement="outside"
                        name={"specificAddress"}
                        placeholder="Đại học RMIT"
                      />
                    </div>
                  </div>

                  {/*City and Country*/}
                  <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                    {/*Quận, huyện */}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        isRequired
                        id={"district"}
                        label="Quận, huyện"
                        labelPlacement="outside"
                        name={"district"}
                        placeholder="Quận 7"
                      />
                    </div>

                    {/*City*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        isRequired
                        id={"city"}
                        label="Tỉnh/Thành phố"
                        labelPlacement="outside"
                        name={"city"}
                        placeholder="Hồ Chí Minh"
                      />
                    </div>
                  </div>

                  {/*Postcode and Phone number*/}
                  <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
                    {/*Postcode*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        id={"postcode"}
                        label="Mã bưu điện"
                        labelPlacement="outside"
                        name={"postcode"}
                        placeholder="700000"
                      />
                    </div>

                    {/*Phone number*/}
                    <div className="group flex flex-col w-full group relative justify-end">
                      <Input
                        required
                        id={"phoneNumber"}
                        label="Số điện thoại"
                        labelPlacement="outside"
                        name={"phoneNumber"}
                        placeholder="0901234567"
                      />
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Huỷ
                  </Button>
                  <Button color="primary" type={"submit"}>
                    Tiến hành thanh toán
                  </Button>
                </ModalFooter>
              </form>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ProductItem;
