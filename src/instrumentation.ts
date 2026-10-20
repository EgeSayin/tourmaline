import type { Instrumentation } from "next";
import { logError } from "@/server/errors/error-log";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const { message, stack } = error instanceof Error ? error : new Error(String(error));
  const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : undefined;
  logError({
    source: "server",
    message,
    stack,
    digest,
    path: request.path,
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
  });
};
