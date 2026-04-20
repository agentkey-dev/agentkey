"use client";

export type ApiEnvelope<T> = {
  data: T;
};

export function unwrapResponseData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}
