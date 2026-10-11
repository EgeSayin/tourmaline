import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORY_COLORS } from "@/lib/categories";
import type { Downtime } from "@/lib/downtime";
import type { SavedQueue } from "@/server/db/plans-repository";
import { type Item, PRIORITIES, SPREAD_STRATEGIES } from "@/lib/items";
import { PLACEMENT_STATUSES, SLOT_MIN } from "@/lib/placements";
import type { Recurrence } from "@/lib/recurrence";
import { DEFAULT_SETTINGS, type FocusCaps } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";

export const priorityEnum = pgEnum("priority", PRIORITIES);
export const timingEnum = pgEnum("timing", ["fixed", "flexible"] as const satisfies readonly Item["timing"][]);
export const spreadEnum = pgEnum("spread", SPREAD_STRATEGIES);
export const placementStatusEnum = pgEnum("placement_status", PLACEMENT_STATUSES);
export const categoryColorEnum = pgEnum("category_color", CATEGORY_COLORS);

// A literal: check constraints can't take parameters.
const slotMin = sql.raw(String(SLOT_MIN));

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const auditColumns = {
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Whose data a row is: a guest's in demo mode, otherwise the one personal workspace a migration creates. */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  lastUsedAt: timestamptz("last_used_at").notNull().defaultNow(),
});

/** A guest's session: only a hash of the token its cookie holds, so a leaked table opens no workspace. */
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/** A workspace's latest plan: when it was made, and the tasks that didn't fit; placements hold the rest. */
export const plans = pgTable("plans", {
  workspaceId: workspaceId().primaryKey(),
  plannedAt: timestamptz("planned_at").notNull(),
  queue: jsonb("queue").$type<SavedQueue>().notNull(),
});

/** One row per workspace. */
export const settings = pgTable(
  "settings",
  {
    workspaceId: workspaceId().primaryKey(),
    timeZone: text("time_zone").$type<TimeZone>().notNull().default(DEFAULT_SETTINGS.timeZone),
    downtime: jsonb("downtime").$type<Downtime>().notNull().default(DEFAULT_SETTINGS.downtime),
    focusCapsMin: jsonb("focus_caps_min").$type<FocusCaps>().notNull().default(DEFAULT_SETTINGS.focusCaps),
    ...auditColumns,
  },
  (t) => [
    check("settings_focus_caps_week", sql`jsonb_array_length(${t.focusCapsMin}) = 7`),
    check("settings_downtime_week", sql`jsonb_array_length(${t.downtime}) = 7`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    color: categoryColorEnum("color").notNull(),
    ...auditColumns,
  },
  (t) => [unique("categories_workspace_name").on(t.workspaceId, t.name)],
);

/** One row per item. The other kind's columns stay null, which `items_kind` enforces along with each kind's own. */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    title: text("title").notNull(),
    priority: priorityEnum("priority").notNull().default("normal"),
    timing: timingEnum("timing").notNull(),
    recurrence: jsonb("recurrence").$type<Recurrence>(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    /** A one-off task marked done; occurrences use their override. Not part of the item's own fields. */
    done: boolean("done").notNull().default(false),
    // Fixed items
    startAt: timestamptz("start_at"),
    endAt: timestamptz("end_at"),
    location: text("location"),
    bufferBeforeMin: integer("buffer_before_min"),
    bufferAfterMin: integer("buffer_after_min"),
    // Tasks
    durationMin: integer("duration_min"),
    earliestStart: timestamptz("earliest_start"),
    deadline: timestamptz("deadline"),
    splitMinChunkMin: integer("split_min_chunk_min"),
    splitMaxChunkMin: integer("split_max_chunk_min"),
    spread: spreadEnum("spread"),
    ...auditColumns,
  },
  (t) => [
    index("items_workspace").on(t.workspaceId),
    check(
      "items_kind",
      sql`case ${t.timing}
        when 'fixed' then num_nonnulls(${t.startAt}, ${t.endAt}, ${t.bufferBeforeMin}, ${t.bufferAfterMin}) = 4
          and num_nonnulls(${t.durationMin}, ${t.earliestStart}, ${t.deadline}, ${t.splitMinChunkMin}, ${t.splitMaxChunkMin}, ${t.spread}) = 0
          and ${t.startAt} < ${t.endAt} and ${t.bufferBeforeMin} >= 0 and ${t.bufferAfterMin} >= 0
        else num_nonnulls(${t.durationMin}, ${t.earliestStart}, ${t.deadline}, ${t.spread}) = 4
          and num_nonnulls(${t.startAt}, ${t.endAt}, ${t.location}, ${t.bufferBeforeMin}, ${t.bufferAfterMin}) = 0
          and ${t.earliestStart} < ${t.deadline} and ${t.durationMin} > 0 and ${t.durationMin} % ${slotMin} = 0
      end`,
    ),
    check(
      "items_split",
      sql`(${t.splitMinChunkMin} is null) = (${t.splitMaxChunkMin} is null) and (${t.splitMinChunkMin} is null or (${t.splitMinChunkMin} between 1 and ${t.splitMaxChunkMin} and ${t.splitMinChunkMin} % ${slotMin} = 0 and ${t.splitMaxChunkMin} % ${slotMin} = 0))`,
    ),
  ],
);

/** Per-occurrence state of a recurring item. The repository removes an item's overrides when it stops recurring. */
export const occurrenceOverrides = pgTable(
  "occurrence_overrides",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrence_date").notNull(),
    skipped: boolean("skipped").notNull().default(false),
    done: boolean("done").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.occurrenceDate] })],
);

/** Where flexible tasks are scheduled. Fixed items never have placements. */
export const placements = pgTable(
  "placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    /** Which occurrence of a recurring task this is for; `null` for a one-off task. */
    occurrenceDate: date("occurrence_date"),
    startAt: timestamptz("start_at").notNull(),
    endAt: timestamptz("end_at").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    status: placementStatusEnum("status").notNull().default("planned"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("placements_times", sql`${t.startAt} < ${t.endAt}`),
    unique("placements_task_start").on(t.itemId, t.occurrenceDate, t.startAt).nullsNotDistinct(),
    index("placements_workspace_start_at").on(t.workspaceId, t.startAt),
  ],
);

export const itemsRelations = relations(items, ({ many }) => ({
  overrides: many(occurrenceOverrides),
}));

export const occurrenceOverridesRelations = relations(occurrenceOverrides, ({ one }) => ({
  item: one(items, { fields: [occurrenceOverrides.itemId], references: [items.id] }),
}));
