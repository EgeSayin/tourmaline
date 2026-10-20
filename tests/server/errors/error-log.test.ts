import { describe, expect, it, vi } from "vitest";
import { logError } from "@/server/errors/error-log";

describe("logError", () => {
  it("writes one JSON line per error to standard error, cutting long texts", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => {});
    const now = new Date("2026-10-20T12:00Z");

    logError({ source: "server", message: "Boom", digest: "123", path: "/tasks", method: "GET", kind: "render" }, now);
    logError({ source: "browser", message: "x".repeat(10_000), path: "/" }, now);

    const lines = write.mock.calls.map(([line]) => JSON.parse(line as string));
    expect(lines[0]).toEqual({
      level: "error",
      time: "2026-10-20T12:00:00.000Z",
      source: "server",
      message: "Boom",
      digest: "123",
      path: "/tasks",
      method: "GET",
      kind: "render",
    });
    expect(lines[1].message).toHaveLength(4000);
    write.mockRestore();
  });
});
