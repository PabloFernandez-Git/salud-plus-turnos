"use client";

import { useEffect, useRef } from "react";

type MessageState = {
  message?: string;
  status: string;
};

export function ActionMessage({ state }: { state: MessageState }) {
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.message) messageRef.current?.focus();
  }, [state.message]);

  if (!state.message) return null;

  const isError = state.status === "error";

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      ref={messageRef}
      role={isError ? "alert" : "status"}
      tabIndex={-1}
    >
      {state.message}
    </p>
  );
}
