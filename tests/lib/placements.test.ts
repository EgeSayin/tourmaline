import { describe, expect, it } from "vitest";
import { type Placement, placementState } from "@/lib/placements";
import { utc } from "../support/intervals";

describe("placementState", () => {
  it("is the status once reviewed, and for a planned placement, whether it has started or ended", () => {
    const block: Placement = {
      taskId: "Essay",
      ...utc("2026-10-05T14:00", "2026-10-05T15:00"),
      pinned: false,
      status: "planned",
    };
    const at = (time: string) => new Date(`2026-10-05T${time}Z`);

    expect(placementState(block, at("13:00"))).toBe("planned");
    expect(placementState(block, at("14:00"))).toBe("planned"); // still pending at its start
    expect(placementState(block, at("14:30"))).toBe("in-progress");
    expect(placementState(block, at("15:00"))).toBe("to-review");
    expect(placementState({ ...block, status: "done" }, at("13:00"))).toBe("done"); // checked off early
    expect(placementState({ ...block, status: "missed" }, at("16:00"))).toBe("missed");
  });
});
