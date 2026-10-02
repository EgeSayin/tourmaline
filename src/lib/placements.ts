export type PlacementSource = "fixed" | "auto" | "manual";

export interface Placement {
  itemId: string;
  start: Date;
  end: Date;
  source: PlacementSource;
  /** Pinned placements are never moved by the scheduler. */
  pinned: boolean;
}
