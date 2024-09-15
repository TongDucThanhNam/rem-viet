"use client";
import React from 'react';
import {
    Accordion,
    AccordionItem,
    Avatar,
    Button, Image,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Spacer,
    useDisclosure
} from "@nextui-org/react";
import {PaymentsIcon} from "@/components/icons/sidebar/payments-icon";
import {CartIcon} from "@nextui-org/shared-icons";
import SwiperThumbnail from "@/components/sidebar/product-thumbnail";
import PurchaseForm from "@/components/form/purchase-form";
import ColorRadio from "@/components/radio/color-radio";
import SizeRadio from "@/components/radio/size-radio";
import {ExportIcon} from "@/components/icons/accounts/export-icon";

// import RadioCustom from "@/components/radio/color-radio";

interface Product {
    id: string;
    name: string;
    description: string;
    price: string;
    imageUrl: string;
}

interface ProductItemProps {
    product: Product;
}

const ProductItem: React.FC<ProductItemProps> = ({product}) => {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();

    return (
        <div className="">
            <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
                {/*Image*/}
                <div className="relative h-full w-full flex-none">
                    {/*Big image*/}
                    <SwiperThumbnail/>
                </div>
                {/*Details*/}
                <div
                    className="flex flex-col">
                    <h1 className="inline bg-gradient-to-br from-foreground-800 to-foreground-500 bg-clip-text text-6xl font-semibold tracking-tight text-transparent dark:to-foreground-200">{product.name}</h1>
                    {/*Price*/}
                    <p className="text-xl font-medium tracking-tight">{product.price} $</p>


                    {/*Ratings*/}
                    <div className="class=my-2 flex items-center gap-2">
                        <span>⭐⭐⭐⭐⭐</span>
                        <span className="">5 reviews</span>
                    </div>


                    {/*Choose attribute*/}
                    <div className="relative flex flex-col gap-2 ml-1 mt-6">
                        <ColorRadio/>
                    </div>

                    <Spacer y={3}/>


                    <p className="line-clamp-3 text-medium ">{product.description}</p>


                    <div className="mt-6 flex flex-col gap-1">
                        <div
                            className="relative flex flex-col gap-1"
                        >
                            <SizeRadio/>
                        </div>
                    </div>

                    <Spacer y={3}/>

                    <Accordion selectionMode="multiple" variant="bordered" className={""}>
                        <AccordionItem
                            key="1"
                            aria-label="Payments"
                            className={""}
                            startContent={
                                <PaymentsIcon/>
                            }
                            title="Payments and Refunds"
                        >
                            {/*    List has dot in start*/}
                            <ul className="list-disc list-inside">
                                <li>You just have purcharse when product is correct</li>
                                <li>You can refund in 7 days</li>
                            </ul>
                        </AccordionItem>
                        <AccordionItem
                            key="2"
                            aria-label="Receipt"
                            startContent={
                                <ExportIcon/>
                            }
                            title="Receipt"
                        >
                            {/*    List has dot in start*/}
                            <ul className="list-disc list-inside">
                                <li>We can send receipt to your email</li>
                            </ul>
                        </AccordionItem>
                    </Accordion>

                    <div className="mt-2 flex gap-2">
                        <Button onPress={onOpen} className={"bg-primary"} startContent={<PaymentsIcon/>}>Buy
                            now</Button>
                        <Button className={"bg-secondary"} startContent={<CartIcon/>}>Add to cart </Button>
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
                                    <ModalHeader>Purcharge</ModalHeader>
                                    <ModalBody>
                                        <PurchaseForm/>
                                    </ModalBody>
                                    <ModalFooter>
                                        <Button color="danger" variant="light" onPress={onClose}>
                                            Cancel
                                        </Button>
                                        <Button color="primary" onPress={onClose}>
                                            Purchase
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