import { AppError, readTextBody } from "@/lib/http";

export const AUTH_FORM_BODY_LIMIT = 8192;

export function isAuthFormRequest(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase()
    === "application/x-www-form-urlencoded";
}

// All authentication forms submit text fields using the browser's default
// encoding. Bound the stream before parsing: request.formData() otherwise reads
// an unbounded body before the rate limiter or authentication checks can run.
export async function readAuthFormData(request: Request) {
  if (!isAuthFormRequest(request)) {
    throw new AppError("Expected a URL-encoded form request body.", 415);
  }

  return new URLSearchParams(await readTextBody(request, AUTH_FORM_BODY_LIMIT));
}
