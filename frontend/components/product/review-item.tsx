"use client";
import React from 'react';
import {
    Accordion,
    AccordionItem,
    Button, Card, CardBody, CardFooter, CardHeader, Divider, Image,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    RadioGroup,
    Spacer, Textarea,
    useDisclosure
} from "@nextui-org/react";
import {PaymentsIcon} from "@/components/icons/sidebar/payments-icon";
import {CartIcon, EditIcon, MailIcon, SearchIcon} from "@nextui-org/shared-icons";
import SwiperThumbnail from "@/components/sidebar/product-thumbnail";
import PurchaseForm from "@/components/form/purchase-form";
import {ExportIcon} from "@/components/icons/accounts/export-icon";
import {cn} from "@/components/radio/cn";
import SizeRadioItem from "@/components/radio/size-radio-item";
import RatingProgress from "@/components/progress/rating-progress";
import {Input} from "@nextui-org/input";

// import RadioCustom from "@/components/radio/color-radio";

interface ReviewItemProps {
}

const ReviewComponent: React.FC<ReviewItemProps> = () => {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();

    return (
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
                            4.4* (Dựa trên 100 đánh giá)
                        </CardHeader>
                        {/*Ratings report*/}
                        <CardBody className={"flex flex-col gap-2"}>
                            <RatingProgress title={"5 ⭐"} value={80}/>

                            <RatingProgress title={"4 ⭐"} value={10}/>

                            <RatingProgress title={"3 ⭐"} value={5}/>

                            <RatingProgress title={"2 ⭐"} value={3}/>

                            <RatingProgress title={"1 ⭐"} value={2}/>
                        </CardBody>

                        {/*Rating add*/}
                        <CardFooter className={"mt-4 flex w-full flex-col gap-4"}>
                            <Button color={"warning"} onPress={onOpen}>
                                Thêm đánh giá
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
                        <h1 className="text-large font-semibold">136 lượt đánh giá</h1>
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
                                                  Minh Nguyễn
                                                </span>
                                            <span className="text-foreground-400 text-small">
                                                  Tháng 10, 2024
                                                </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">⭐⭐⭐⭐⭐</div>
                            </div>
                            <div className="mt-4 w-full">
                                <p className="font-medium text-default-900">Sản phẩm tuyệt vời</p>
                                <p className="mt-2 text-default-500">
                                    Sản phẩm rất tốt, chất lượng tuyệt vời và giá cả phải chăng.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewComponent;