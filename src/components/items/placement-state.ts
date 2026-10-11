import type { PlacementState } from "@/lib/placements";

export const PLACEMENT_STATE_LABELS = {
  planned: "Planned",
  "in-progress": "In progress",
  "to-review": "To review",
  done: "Done",
  missed: "Missed",
} satisfies Record<PlacementState, string>;
