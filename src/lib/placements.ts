/** `auto`: chosen by the scheduler. `manual`: placed by the user. */
export const PLACEMENT_SOURCES = ["auto", "manual"] as const;

export type PlacementSource = (typeof PLACEMENT_SOURCES)[number];

/** Where (part of) a flexible task is scheduled. Fixed items have no placements; their own times are final. */
export interface Placement {
  itemId: string;
  start: Date;
  end: Date;
  source: PlacementSource;
  /** Pinned placements are never moved by the scheduler. */
  pinned: boolean;
}
