import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORY_COLORS } from "@/lib/categories";
import type { Downtime } from "@/lib/downtime";
import type { SavedQueue } from "@/server/db/plans-repository";
import { PRIORITIES, SPREAD_STRATEGIES } from "@/lib/items";
import { PLACEMENT_STATUSES, SLOT_MIN } from "@/lib/placements";
import type { Occurrences, Recurrence } from "@/lib/recurrence";
import { DEFAULT_SETTINGS, type FocusCaps } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";

export const priorityEnum = pgEnum("priority", PRIORITIES);
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

/** What fixed items and tasks share. */
const itemColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: workspaceId(),
  title: text("title").notNull(),
  priority: priorityEnum("priority").notNull().default("normal"),
  recurrence: jsonb("recurrence").$type<Recurrence>(),
  /** The repository empties it when the item stops recurring. */
  occurrences: jsonb("occurrences").$type<Occurrences>().notNull().default({}),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  ...auditColumns,
});

export const fixedItems = pgTable(
  "fixed_items",
  {
    ...itemColumns(),
    startAt: timestamptz("start_at").notNull(),
    endAt: timestamptz("end_at").notNull(),
    location: text("location"),
    bufferBeforeMin: integer("buffer_before_min").notNull(),
    bufferAfterMin: integer("buffer_after_min").notNull(),
  },
  (t) => [
    index("fixed_items_workspace").on(t.workspaceId),
    check("fixed_items_times", sql`${t.startAt} < ${t.endAt}`),
    check("fixed_items_buffers", sql`${t.bufferBeforeMin} >= 0 and ${t.bufferAfterMin} >= 0`),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    ...itemColumns(),
    durationMin: integer("duration_min").notNull(),
    earliestStart: timestamptz("earliest_start").notNull(),
    deadline: timestamptz("deadline").notNull(),
    splitMinChunkMin: integer("split_min_chunk_min"),
    splitMaxChunkMin: integer("split_max_chunk_min"),
    spread: spreadEnum("spread").notNull(),
    /** A one-off task marked done; occurrences use their state. Not part of the task's own fields. */
    done: boolean("done").notNull().default(false),
  },
  (t) => [
    index("tasks_workspace").on(t.workspaceId),
    check("tasks_window", sql`${t.earliestStart} < ${t.deadline}`),
    check("tasks_duration", sql`${t.durationMin} > 0 and ${t.durationMin} % ${slotMin} = 0`),
    check(
      "tasks_split",
      sql`(${t.splitMinChunkMin} is null) = (${t.splitMaxChunkMin} is null) and (${t.splitMinChunkMin} is null or (${t.splitMinChunkMin} between 1 and ${t.splitMaxChunkMin} and ${t.splitMinChunkMin} % ${slotMin} = 0 and ${t.splitMaxChunkMin} % ${slotMin} = 0))`,
    ),
  ],
);

/** Where tasks are scheduled. */
export const placements = pgTable(
  "placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** Which occurrence of a recurring task this is for; `null` for a one-off task. */
    occurrenceDate: date("occurrence_date"),
    startAt: timestamptz("start_at").notNull(),
    endAt: timestamptz("end_at").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    status: placementStatusEnum("status").notNull().default("planned"),
  },
  (t) => [
    check("placements_times", sql`${t.startAt} < ${t.endAt}`),
    unique("placements_task_start").on(t.itemId, t.occurrenceDate, t.startAt).nullsNotDistinct(),
    index("placements_workspace_start_at").on(t.workspaceId, t.startAt),
  ],
);
