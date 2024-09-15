"use client"; // <===== REQUIRED

import React from "react";
import {Card, CardBody, Image} from "@nextui-org/react";
import NextImage from "next/image";
import { useRouter } from 'next/navigation';
const CardItem = ({
                      name,
                      description,
                      price,
                      productId,
                      productSize,
                  }: {
    name: string;
    description: string;
    price: string;
    productId: string;
    productSize: string[];
}) => {
    const router = useRouter();

    return (
        <Card className="border-none bg-background/60 dark:bg-default-100/50 max-w-[610px]"
              isFooterBlurred
              isBlurred
              isPressable={true}
              onPress={() => {
                  router.push(`/product/${productId}`)
              }}
        >
            <Image
                isBlurred
                isZoomed
                alt={"Image"}
                as={NextImage}
                className="relative z-10 opacity-0 shadow-black/5 data-[loaded=true]:opacity-100 shadow-none object-cover transform transition-transform-opacity motion-reduce:transition-none !duration-300 rounded-large aspect-square w-full hover:scale-110"
                height={300}
                layout={"responsive"}
                quality={75}
                src={"/src/product.webp"}
                width={300}
            />
            <CardBody className="relative shadow-black/5 shadow-none rounded-large">
                <div className={"mt-1 flex flex-col gap-2 px-1"}>
                    <div className="mt-1 flex flex-col gap-2 px-1">
                        <div className="flex items-start justify-between gap-1">
                            <h3 className="text-small font-medium text-default-700">
                                {name}
                            </h3>
                            <div className="flex items-center gap-1">
                                <svg
                                    aria-hidden="true"
                                    className="text-default-500 iconify iconify--solar"
                                    height="16"
                                    role="img"
                                    viewBox="0 0 24 24"
                                    width="16"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M9.153 5.408C10.42 3.136 11.053 2 12 2c.947 0 1.58 1.136 2.847 3.408l.328.588c.36.646.54.969.82 1.182c.28.213.63.292 1.33.45l.636.144c2.46.557 3.689.835 3.982 1.776c.292.94-.546 1.921-2.223 3.882l-.434.507c-.476.557-.715.836-.822 1.18c-.107.345-.071.717.001 1.46l.066.677c.253 2.617.38 3.925-.386 4.506c-.766.582-1.918.051-4.22-1.009l-.597-.274c-.654-.302-.981-.452-1.328-.452c-.347 0-.674.15-1.328.452l-.596.274c-2.303 1.06-3.455 1.59-4.22 1.01c-.767-.582-.64-1.89-.387-4.507l.066-.676c.072-.744.108-1.116 0-1.46c-.106-.345-.345-.624-.821-1.18l-.434-.508c-1.677-1.96-2.515-2.941-2.223-3.882c.293-.941 1.523-1.22 3.983-1.776l.636-.144c.699-.158 1.048-.237 1.329-.45c.28-.213.46-.536.82-1.182z"
                                        fill="currentColor"
                                    />
                                </svg>
                                <span className="text-small text-default-500">5.0</span>
                            </div>
                        </div>
                        <p className="text-small text-default-500">{description}</p>
                        <p className="text-small font-medium text-default-500">{price}</p>


                    </div>
                </div>
            </CardBody>
            {/*<CardFooter>*/}
            {/*    <div className={"space-x-4 flex content-center justify-end"}>*/}
            {/*        <Button*/}
            {/*            // onClick={handleCartClick}*/}
            {/*            isIconOnly*/}
            {/*        >*/}
            {/*            <CartIcon/>*/}
            {/*        </Button>*/}

            {/*        <Link href={`/product/${productId}`}>*/}
            {/*            <Button*/}
            {/*                // onClick={handleInfoClick}*/}
            {/*                isIconOnly={true}*/}
            {/*                startContent={<InfoIcon/>}*/}
            {/*            />*/}
            {/*        </Link>*/}
            {/*    </div>*/}
            {/*</CardFooter>*/}
        </Card>
    );
};

export default CardItem;
