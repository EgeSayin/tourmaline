import { describe, expect, it } from "vitest";
import { parseFocusCaps } from "@/server/settings/parse-focus-caps";

describe("parseFocusCaps", { tags: ["unit"] }, () => {
  it("turns each weekday's hours into minutes, empty for no cap, and rejects hours outside a day", () => {
    const week = { cap1: "8", cap2: "7.5", cap3: "0", cap4: "", cap5: "6.25", cap6: "4" };

    expect(parseFocusCaps(week)).toEqual({ ok: true, focusCaps: [480, 450, 0, null, 375, 240, null] });
    expect(parseFocusCaps({ ...week, cap2: "25", cap3: "-1", cap4: "a lot" })).toEqual({
      ok: false,
      errors: {
        cap2: ["Enter 0 to 24 hours"],
        cap3: ["Enter 0 to 24 hours"],
        cap4: ["Enter a number of hours"],
      },
    });
  });
});
