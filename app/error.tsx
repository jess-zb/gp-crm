"use client";

import NextError from "next/error";

export default function Error({
  error: _error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <NextError statusCode={0} />;
}
