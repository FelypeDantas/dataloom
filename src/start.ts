import { createMiddleware, createStart } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
} as const;

interface HttpError {
  statusCode: number;
}

const isHttpError = (error: unknown): error is HttpError =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in (error as Record<string, unknown>);

function logServerError(error: unknown) {
  if (import.meta.env.DEV) {
    console.error("[Server]", error);
  }
}

const serverErrorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isHttpError(error)) {
      throw error;
    }

    logServerError(error);

    return new Response(renderErrorPage(), {
      status: 500,
      headers: HTML_HEADERS,
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [serverErrorMiddleware],
}));
