"use client";

// import CustomButton from "@/components/product/button";
import {EditIcon, MailIcon, SearchIcon} from "@nextui-org/shared-icons";
import {Button} from "@nextui-org/button";
import {Input} from "@nextui-org/input";
import {
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Divider,
    Image,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Textarea,
    useDisclosure,
} from "@nextui-org/react";
import React, {useEffect} from "react";

import RatingProgress from "@/components/progress/rating-progress";
import ProductItem from "@/components/product/product-item";

export default function ProductPage({params}: { params: { productId: string } }) {
    const productId = params.productId;
    const {isOpen, onOpen, onOpenChange} = useDisclosure();

    const [product, setProduct] = React.useState<any>(
        {
            id: "1",
            name: "Product 1fsf",
            price: "123123-412412",
            imageUrl: "/src/product.webp",
            description:
                "The Nike Air Max 270 delivers an even more adaptive fit than before. Stretch material in the upper moves with your foot, while the tri-star outsole pattern adjusts to your every step for a ride that delivers support and flexibility where you need it.",
        }
    );

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await fetch(`http://localhost:3001/api/product/${productId}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                /*
                    {
                      "message": "Product found",
                      "statusCode": 200,
                      "data": {
                        "productId": "66e6a5b13b1943628778d81d",
                        "name": "Product2",
                        "description": "dakwndnk",
                        "size": [
                          30,
                          30,
                          10
                        ],
                        "price": "33 - 4524"
                      }
                    }
                 */

                if (data.statusCode !== 200) {
                    //TODO: 404 Product not found
                    console.error("Product not found:", data);
                }

                setProduct({
                    id: data.data.productId ?? "1",
                    name: data.data.name ?? "Product 1",
                    price: data.data.price ?? "123123-412412",
                    description: data.data.description ?? "Product description",
                    imageUrl: data.data.imageUrl ?? "/src/product.webp",
                });
                console.log("Product fetched:", data);

            } catch (error) {
                console.error("Failed to fetch product:", error);
            }
        };
        fetchProduct();
    }, [productId]);

    return (
        //returning button
        <div>
            <ProductItem product={product}/>

            {/* Review */}
            <div className={"flex items-center justify-center mt-6"}>
                <div
                    className={
                        "mx-auto w-full max-w-6xl px-2 sm:px-6 lg:grid lg:max-w-7xl lg:grid-cols-12 lg:gap-x-12 lg:px-6"
                    }
                >
                    <Card className={"lg:col-span-4"}>
                        <div
                            className={
                                "flex flex-col gap-2 rounded-medium p-6 shadow-small"
                            }
                        >
                            {/*Rating general*/}
                            <CardHeader className={"flex items-center gap-2"}>
                                4.4* (Base on 100 reviews)
                            </CardHeader>
                            {/*Ratings report*/}
                            <CardBody className={"flex flex-col gap-2"}>
                                <RatingProgress title={"5 stars"} value={80}/>

                                <RatingProgress title={"4 stars"} value={10}/>

                                <RatingProgress title={"3 stars"} value={5}/>

                                <RatingProgress title={"2 stars"} value={3}/>

                                <RatingProgress title={"1 stars"} value={2}/>
                            </CardBody>

                            {/*Rating add*/}
                            <CardFooter className={"mt-4 flex w-full flex-col gap-4"}>
                                <Button color={"warning"} onPress={onOpen}>
                                    Add review
                                </Button>
                                <Modal
                                    isOpen={isOpen}
                                    placement="top-center"
                                    onOpenChange={onOpenChange}
                                >
                                    <ModalContent>
                                        {(onClose) => (
                                            <>
                                                <ModalHeader className="flex flex-col gap-1">
                                                    Write a review
                                                </ModalHeader>
                                                <ModalBody>
                                                    <Input
                                                        placeholder={"Name"}
                                                        startContent={<MailIcon/>}
                                                    />
                                                    <Input
                                                        placeholder={"Email"}
                                                        startContent={<MailIcon/>}
                                                    />
                                                    <Divider/>
                                                    <Input
                                                        placeholder={"Rating"}
                                                        startContent={<MailIcon/>}
                                                        type={"number"}
                                                    />

                                                    <Input
                                                        placeholder={"Title"}
                                                        startContent={<EditIcon/>}
                                                    />
                                                    <Textarea
                                                        placeholder={"Description"}
                                                        startContent={<EditIcon/>}
                                                    />
                                                </ModalBody>
                                                <ModalFooter>
                                                    <Button
                                                        color="danger"
                                                        variant="flat"
                                                        onPress={onClose}
                                                    >
                                                        Close
                                                    </Button>
                                                    <Button color="primary" onPress={onClose}>
                                                        Sign in
                                                    </Button>
                                                </ModalFooter>
                                            </>
                                        )}
                                    </ModalContent>
                                </Modal>
                            </CardFooter>
                        </div>
                    </Card>

                    <div className={"mt-16 lg:col-span-8 lg:mt-0"}>
                        <div
                            className={"flex flex-wrap items-center justify-between gap-4"}
                        >
                            <h1 className="text-large font-semibold">136 Reviews</h1>
                            {/* Search*/}
                            <Input
                                placeholder={"Search reviews"}
                                startContent={<SearchIcon/>}
                            />
                        </div>

                        {/*Review*/}
                        <div className={"mt-4 flex flex-col"}>
                            <div className="border-divider px-2 py-10 [&amp;:not(:last-child)]:border-b-1">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="inline-flex items-center justify-center gap-2 rounded-small outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2"
                                                tabIndex={-1}
                                            >
                        <span
                            className="flex relative justify-center items-center box-border overflow-hidden align-middle z-0 outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 w-10 h-10 text-tiny bg-default text-default-foreground rounded-full"
                            tabIndex={-1}
                        >
                          <Image
                              alt="John Doe"
                              className="flex object-cover w-full h-full transition-opacity !duration-500 opacity-0 data-[loaded=true]:opacity-100"
                              data-loaded="true"
                              src="https://i.pravatar.cc/150?u=a04258114e29026708c"
                          />
                        </span>
                                            </div>
                                            <div className="inline-flex flex-col items-start">
                        <span className="text-small text-inherit font-medium">
                          John Doe
                        </span>
                                                <span className="text-foreground-400 text-small">
                          August 1, 2021
                        </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">****</div>
                                </div>
                                <div className="mt-4 w-full">
                                    <p className="font-medium text-default-900">Great product</p>
                                    <p className="mt-2 text-default-500">
                                        Lorem ipsum dolor sit amet consectetur adipisicing elit.
                                        Quisquam, voluptatibus.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
