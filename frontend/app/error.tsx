"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        padding: "1rem",
        backgroundColor: "#f3f4f6",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          padding: "2rem",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow:
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            marginBottom: "1rem",
            fontSize: "1.5rem",
            fontWeight: "bold",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            color: "#4b5563",
          }}
        >
          {error.message || "We're sorry, but an unexpected error occurred."}
        </p>
        <button
          style={{
            width: "100%",
            padding: "0.5rem 1rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
          onClick={reset}
        >
          Try again
        </button>
        {error.digest && (
          <p
            style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#6b7280" }}
          >
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
