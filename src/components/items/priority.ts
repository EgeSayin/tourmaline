import { PRIORITIES, type Priority } from "@/lib/items";

export const PRIORITY_LABELS = {
  mandatory: "Mandatory",
  high: "High",
  normal: "Normal",
  low: "Low",
} satisfies Record<Priority, string>;

export const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }));
