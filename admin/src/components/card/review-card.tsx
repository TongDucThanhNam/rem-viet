import { Card, CardBody, CardHeader } from "@nextui-org/react";
import FacebookIcon from "@/components/icons/icons";


interface ReviewCardProps {
  userName: string;
  reviewDate: string;
  reviewTitle: string;
  reviewContent: string;
}

export default function ReviewCard({ review }: { review: ReviewCardProps }) {
  return (
    <>
      <Card isBlurred={false} shadow={"lg"}>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="inline-flex items-center justify-center gap-2"
              tabIndex={-1}
            >
              <FacebookIcon />

              <div className="inline-flex flex-col items-start">
                <span className="text-small text-inherit font-medium">
                  {review.userName}
                </span>
                <span className="text-small">{review.reviewDate}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="w-full">
          <p className="font-medium text-2xl">{review.reviewTitle}</p>
          <p className="mt-2">{review.reviewContent}</p>
        </CardBody>
      </Card>
    </>
  );
}
