import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

interface ServerEntry {
  fetch(
    request: Request,
    env: unknown,
    ctx: unknown,
  ): Promise<Response> | Response;
}

interface H3ErrorPayload {
  unhandled: true;
  message: "HTTPError";
}

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
} satisfies HeadersInit;

let serverEntryPromise: Promise<ServerEntry> | null = null;

const getServerEntry = () =>
  (serverEntryPromise ??= import("@tanstack/react-start/server-entry").then(
    (mod) => (mod.default ?? mod) as ServerEntry,
  ));

const create500Response = () =>
  new Response(renderErrorPage(), {
    status: 500,
    headers: HTML_HEADERS,
  });

function reportError(error: unknown) {
  console.error(
    consumeLastCapturedError() ??
      error ??
      new Error("Unknown server error"),
  );
}

function isH3Error(value: unknown): value is H3ErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).unhandled === true &&
    (value as Record<string, unknown>).message === "HTTPError"
  );
}

async function normalizeResponse(response: Response) {
  if (
    response.status < 500 ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return response;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(await response.clone().text());
  } catch {
    return response;
  }

  if (!isH3Error(payload)) {
    return response;
  }

  reportError(new Error("H3 swallowed an SSR error"));

  return create500Response();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const response = await (await getServerEntry()).fetch(request, env, ctx);

      return normalizeResponse(response);
    } catch (error) {
      reportError(error);
      return create500Response();
    }
  },
};
