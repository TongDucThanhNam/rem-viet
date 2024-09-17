"use client";
import React from 'react';
import {
    Accordion,
    AccordionItem,
    Button,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    RadioGroup,
    Spacer,
    useDisclosure
} from "@nextui-org/react";
import {PaymentsIcon} from "@/components/icons/sidebar/payments-icon";
import {CartIcon} from "@nextui-org/shared-icons";
import SwiperThumbnail from "@/components/sidebar/product-thumbnail";
import PurchaseForm from "@/components/form/purchase-form";
import {ExportIcon} from "@/components/icons/accounts/export-icon";
import {cn} from "@/components/radio/cn";
import SizeRadioItem from "@/components/radio/size-radio-item";

// import RadioCustom from "@/components/radio/color-radio";

interface Product {
    id: string;
    name: string;
    imageUrls: string[];
    description: string;
    price: string;
    imageUrl: string;
}

interface ProductItemProps {
    product: Product;
    variants: any
}

const ProductItem: React.FC<ProductItemProps> = ({product, variants}) => {
    const basePrice = product.price;

    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const [variantChosen, setVariantChosen] = React.useState<any>([]);
    //product price
    const [productPrice, setProductPrice] = React.useState<string>(product.price);

    //preprocess variants
    let preProcessingVariant: { [key: string]: string[] } = {};

    for (const variant of variants) {
        let values;

        // Check if variant.values is a string
        if (typeof variant.values === 'string') {
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
            // product.price = basePrice;
            setProductPrice(basePrice);
            return;
        }

        //Update price
        for (const variant of variants) {
            let values;

            // Check if variant.values is a string
            if (typeof variant.values === 'string') {
                // Parse the JSON string into an object
                values = JSON.parse(variant.values);
            } else {
                // Use the object directly
                values = variant.values;
            }

            if (areObjectsEqual(values, variantChosen)) {
                console.log("Found variant: ", variant);
                setProductPrice(variant.variantPrice);
                // product.price = variant.price;
                return;
            }
        }

        //set new price
        // product.price = price;
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

    return (
        <div className="">
            <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
                {/*Image*/}
                <div className="relative h-full w-full flex-none">
                    {/*Big image*/}
                    <SwiperThumbnail imageUrls={product.imageUrls}/>
                </div>
                {/*Details*/}
                <div
                    className="flex flex-col">
                    <h1 className="inline bg-gradient-to-br from-foreground-800 to-foreground-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">{product.name}</h1>
                    {/*Price*/}
                    <p className="text-xl font-medium tracking-tight">{productPrice}₫</p>


                    {/*Ratings*/}
                    <div className="class=my-2 flex items-center gap-2">
                        <span>⭐⭐⭐⭐⭐</span>
                        <span className="">5 lượt đánh giá</span>
                    </div>

                    <Spacer y={3}/>

                    <Spacer y={3}/>

                    {/*Variants*/}
                    {Object.keys(preProcessingVariant).map((key, index) => (
                        <div key={index} className="flex flex-col gap-2">
                            <p className="text-lg font-semibold">{key}</p>
                            <RadioGroup
                                value={variantChosen[key]}
                                classNames={{
                                    base: cn("", "max-w-fit"),
                                    wrapper: cn("", "gap-3"),
                                }}
                                defaultValue="1"
                                orientation="horizontal"
                                size="lg"
                                onValueChange={(value) => {
                                    setVariantChosen({...variantChosen, [key]: value});
                                }}
                            >
                                {preProcessingVariant[key].map((value: string, index: number) => (
                                    <SizeRadioItem key={index} value={value}/>
                                ))}
                            </RadioGroup>
                        </div>
                    ))}


                    <Spacer y={3}/>

                    <Accordion selectionMode="multiple" variant="bordered" className={""}>
                        <AccordionItem
                            key="0"
                            aria-label="Payments"
                            className={""}
                            subtitle={<p className="line-clamp-3 text-medium ">{product.description}</p>}
                            title="Mô tả sản phẩm"
                        >
                            <p className="text-medium ">{product.description}</p>
                        </AccordionItem>

                        <AccordionItem
                            key="1"
                            aria-label="Payments"
                            className={""}
                            startContent={
                                <PaymentsIcon/>
                            }
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
                            startContent={
                                <ExportIcon/>
                            }
                            title="Hoá đơn và bảo hành"
                        >
                            {/*    List has dot in start*/}
                            <ul className="list-disc list-inside">
                                <li>Chúng tôi có thể gửi hoá đơn đến email cho bạn</li>
                            </ul>
                        </AccordionItem>
                    </Accordion>

                    <div className="mt-2 flex gap-2">
                        <Button onPress={onOpen} color={"primary"} className={""} startContent={<PaymentsIcon/>}>
                            Mua ngay
                        </Button>
                        <Button className={""} color={"secondary"} startContent={<CartIcon/>}>
                            Thêm vào giỏ hàng
                        </Button>
                    </div>

                    <Modal
                        size={"xl"}
                        placement={"bottom-center"}
                        isOpen={isOpen}
                        onOpenChange={onOpenChange}
                        scrollBehavior={"inside"}
                        backdrop={"blur"}
                        isDismissable={false}
                        isKeyboardDismissDisabled={true}
                        classNames={{
                            body: "",
                            backdrop: "",
                            base: "",
                            header: "",
                            footer: "",
                            closeButton: "",
                        }}
                    >
                        <ModalContent>
                            {(onClose) => (
                                <>
                                    <ModalHeader>Thanh toán</ModalHeader>
                                    <ModalBody>
                                        <PurchaseForm/>
                                    </ModalBody>
                                    <ModalFooter>
                                        <Button color="danger" variant="light" onPress={onClose}>
                                            Huỷ
                                        </Button>
                                        <Button color="primary" onPress={onClose}>
                                            Tiến hành thanh toán
                                        </Button>
                                    </ModalFooter>
                                </>
                            )}
                        </ModalContent>
                    </Modal>
                </div>
            </div>
        </div>
    );
};

export default ProductItem;