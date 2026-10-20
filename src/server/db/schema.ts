import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type PgColumn,
} from "drizzle-orm/pg-core";
import { CATEGORY_COLORS } from "@/lib/categories";
import type { Downtime } from "@/lib/downtime";
import { PRIORITIES, SPREAD_STRATEGIES } from "@/lib/items";
import { PLACEMENT_STATUSES, SLOT_MIN } from "@/lib/placements";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import type { Occurrences, Recurrence } from "@/lib/recurrence";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";

export const priorityEnum = pgEnum("priority", PRIORITIES);
export const spreadEnum = pgEnum("spread", SPREAD_STRATEGIES);
export const placementStatusEnum = pgEnum("placement_status", PLACEMENT_STATUSES);
export const categoryColorEnum = pgEnum("category_color", CATEGORY_COLORS);

// A literal: check constraints can't take parameters.
const slotMin = sql.raw(String(SLOT_MIN));
const minutesPerDay = sql.raw(String(MINUTES_PER_DAY));

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const auditColumns = {
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * The role a workspace transaction takes (see `inWorkspace`), so the database itself keeps it to the rows of the
 * workspace it set; the migration that introduced it creates it. Owner connections aren't held to the policies.
 */
export const workspaceUser = pgRole("workspace_user").existing();

/** Lets `workspaceUser` see and change only rows whose `column` is the workspace its transaction set. */
function ownRows(column: PgColumn) {
  const own = sql`${column} = current_setting('app.workspace_id')::uuid`;
  return pgPolicy("own_rows", { to: workspaceUser, using: own, withCheck: own });
}

/** Whose data a row is: a guest's in demo mode, otherwise the one personal workspace a migration creates. */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastUsedAt: timestamptz("last_used_at").notNull().defaultNow(),
    /** When it was last planned; its placements and items then make the plan. `null` until it first is. */
    plannedAt: timestamptz("planned_at"),
  },
  (t) => [ownRows(t.id)],
);

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

/** One row per workspace. */
export const settings = pgTable(
  "settings",
  {
    workspaceId: workspaceId().primaryKey(),
    timeZone: text("time_zone").$type<TimeZone>().notNull().default(DEFAULT_SETTINGS.timeZone),
    downtime: jsonb("downtime").$type<Downtime>().notNull().default(DEFAULT_SETTINGS.downtime),
    ...auditColumns,
  },
  (t) => [ownRows(t.workspaceId), check("settings_downtime_week", sql`jsonb_array_length(${t.downtime}) = 7`)],
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
  (t) => [
    ownRows(t.workspaceId),
    unique("categories_workspace_name").on(t.workspaceId, t.name),
    // For items' foreign key, which keeps their category in their workspace.
    unique("categories_workspace_id").on(t.workspaceId, t.id),
  ],
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
  categoryId: uuid("category_id"),
  ...auditColumns,
});

/**
 * What fixed items and tasks are both held to. Deleting a category clears it from its items: the migration makes the
 * foreign key set only `category_id` null, which Drizzle can't express.
 */
const itemConstraints = (table: string, t: { workspaceId: PgColumn; recurrence: PgColumn; categoryId: PgColumn }) => [
  ownRows(t.workspaceId),
  index(`${table}_workspace`).on(t.workspaceId),
  check(`${table}_interval`, sql`(${t.recurrence}->>'interval')::integer >= 1`),
  foreignKey({
    name: `${table}_category_fk`,
    columns: [t.workspaceId, t.categoryId],
    foreignColumns: [categories.workspaceId, categories.id],
  }).onDelete("set null"),
];

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
    ...itemConstraints("fixed_items", t),
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
    withinPeriod: boolean("within_period").notNull().default(false),
    timeOfDayStartMin: integer("time_of_day_start_min"),
    timeOfDayEndMin: integer("time_of_day_end_min"),
    timeOfDayMust: boolean("time_of_day_must"),
    /** A one-off task marked done; occurrences use their state. Not part of the task's own fields. */
    done: boolean("done").notNull().default(false),
  },
  (t) => [
    ...itemConstraints("tasks", t),
    check("tasks_window", sql`${t.earliestStart} < ${t.deadline}`),
    check("tasks_within_period", sql`not ${t.withinPeriod} or ${t.recurrence} is not null`),
    check(
      "tasks_time_of_day",
      sql`(${t.timeOfDayStartMin} is null) = (${t.timeOfDayEndMin} is null) and (${t.timeOfDayStartMin} is null) = (${t.timeOfDayMust} is null) and (${t.timeOfDayStartMin} is null or (0 <= ${t.timeOfDayStartMin} and ${t.timeOfDayStartMin} < ${t.timeOfDayEndMin} and ${t.timeOfDayEndMin} <= ${minutesPerDay} and ${t.timeOfDayStartMin} % ${slotMin} = 0 and ${t.timeOfDayEndMin} % ${slotMin} = 0))`,
    ),
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
    ownRows(t.workspaceId),
    check("placements_times", sql`${t.startAt} < ${t.endAt}`),
    // DEFERRABLE in the migration, which Drizzle can't declare, so one statement can shift every start.
    unique("placements_task_start").on(t.itemId, t.occurrenceDate, t.startAt).nullsNotDistinct(),
    index("placements_workspace_start_at").on(t.workspaceId, t.startAt),
  ],
);
