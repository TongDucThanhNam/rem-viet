'use client'

import { useEffect } from 'react'
import {Button} from "@nextui-org/react";
import {AnchorIcon} from "@nextui-org/shared-icons";

export default function Error({
                                  error,
                                  reset,
                              }: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
                <div className="text-center">
                    <AnchorIcon className="mx-auto h-12 w-12 text-red-500" aria-hidden="true" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Oops! Something went wrong</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {error.message || "We're sorry, but an unexpected error occurred."}
                    </p>
                </div>
                <div className="mt-8 space-y-6">
                    <Button
                        onClick={reset}
                        className="w-full flex justify-center py-2 px-4"
                    >
                        Try again
                    </Button>
                    <div className="text-sm text-center">
                        <a href="/" className="font-medium text-primary hover:text-primary/80">
                            Go back to homepage
                        </a>
                    </div>
                </div>
                {error.digest && (
                    <p className="mt-4 text-center text-sm text-gray-500">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    )
}