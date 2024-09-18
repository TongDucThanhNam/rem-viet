import React from "react";

interface Props extends React.SVGAttributes<SVGElement> {
}

export const ChevronUpIcon = ({...props}: Props) => {
    return (
        <svg
            height="24"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                className="fill-default-400"
                d="m6.293 13.293 1.414 1.414L12 10.414l4.293 4.293 1.414-1.414L12 7.586z"
            />
        </svg>
    );
};
