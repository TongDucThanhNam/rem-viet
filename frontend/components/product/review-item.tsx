"use client";
import React from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Textarea,
  useDisclosure,
} from "@nextui-org/react";
import { EditIcon, MailIcon, SearchIcon } from "@nextui-org/shared-icons";
import RatingProgress from "@/components/progress/rating-progress";

// import RadioCustom from "@/components/radio/color-radio";

interface ReviewItemProps {
  isLoading: boolean;
}

const ReviewComponent: React.FC<ReviewItemProps> = ({
  isLoading,
}: {
  isLoading: boolean;
}) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <div className={"flex items-center justify-center mt-6"}>
      <div
        className={
          "mx-auto w-full max-w-6xl px-2 sm:px-6 lg:grid lg:max-w-7xl lg:grid-cols-12 lg:gap-x-12 lg:px-6"
        }
      >
        <Card className={"lg:col-span-4"}>
          <div
            className={"flex flex-col gap-2 rounded-medium p-6 shadow-small"}
          >
            {/*Rating general*/}
            <CardHeader className={"flex items-center gap-2"}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Skeleton>
                    <h1 className="text-large font-semibold">
                      4.4* (Dựa trên 100 đánh giá)
                    </h1>
                  </Skeleton>
                </div>
              ) : (
                <h1 className="text-large font-semibold">
                  4.4* (Dựa trên 100 đánh giá)
                </h1>
              )}
            </CardHeader>
            {/*Ratings report*/}
            <CardBody className={"flex flex-col gap-2"}>
              <RatingProgress isLoading={isLoading} title={"5 ⭐"} value={80} />

              <RatingProgress isLoading={isLoading} title={"4 ⭐"} value={10} />

              <RatingProgress isLoading={isLoading} title={"3 ⭐"} value={5} />

              <RatingProgress isLoading={isLoading} title={"2 ⭐"} value={3} />

              <RatingProgress isLoading={isLoading} title={"1 ⭐"} value={2} />
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
                          startContent={<MailIcon />}
                        />
                        <Input
                          placeholder={"Email"}
                          startContent={<MailIcon />}
                        />
                        <Divider />
                        <Input
                          placeholder={"Rating"}
                          startContent={<MailIcon />}
                          type={"number"}
                        />

                        <Input
                          placeholder={"Title"}
                          startContent={<EditIcon />}
                        />
                        <Textarea
                          placeholder={"Description"}
                          startContent={<EditIcon />}
                        />
                      </ModalBody>
                      <ModalFooter>
                        <Button color="danger" variant="flat" onPress={onClose}>
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
          <div className={"flex flex-wrap items-center justify-between gap-4"}>
            {isLoading ? (
              <Skeleton>
                <h1 className="text-large font-semibold">100 lượt đánh giá</h1>
              </Skeleton>
            ) : (
              <h1 className="text-large font-semibold">100 lượt đánh giá</h1>
            )}
            {/* Search*/}
            <Input
              placeholder={"Search reviews"}
              startContent={<SearchIcon />}
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
                          alt="User avatar"
                          className="flex object-cover w-full h-full transition-opacity !duration-500 opacity-0 data-[loaded=true]:opacity-100"
                          data-loaded="true"
                          src="/src/user-avatar.jpeg"
                        />
                      </span>
                    </div>
                    <div className="inline-flex flex-col items-start">
                      {isLoading ? (
                        <Skeleton>
                          <span className="text-small text-inherit font-medium">
                            Minh Nguyễn
                          </span>
                        </Skeleton>
                      ) : (
                        <span className="text-small text-inherit font-medium">
                          Minh Nguyễn
                        </span>
                      )}

                      {isLoading ? (
                        <Skeleton>
                          <span className="text-foreground-400 text-small">
                            Tháng 10, 2024
                          </span>
                        </Skeleton>
                      ) : (
                        <span className="text-foreground-400 text-small">
                          Tháng 10, 2024
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isLoading ? (
                  <Skeleton>
                    <div className="flex items-center gap-1">⭐⭐⭐⭐⭐</div>
                  </Skeleton>
                ) : (
                  <div className="flex items-center gap-1">⭐⭐⭐⭐⭐</div>
                )}
              </div>
              <div className="mt-4 w-full">
                {isLoading ? (
                  <Skeleton>
                    <p className="font-medium text-default-900">
                      Sản phẩm tuyệt vời
                    </p>
                  </Skeleton>
                ) : (
                  <p className="font-medium text-default-900">
                    Sản phẩm tuyệt vời
                  </p>
                )}

                {isLoading ? (
                  <Skeleton>
                    Sản phẩm rất tốt, chất lượng tuyệt vời và giá cả phải chăng.
                  </Skeleton>
                ) : (
                  <p className="mt-2 text-default-500">
                    Sản phẩm rất tốt, chất lượng tuyệt vời và giá cả phải chăng.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewComponent;
