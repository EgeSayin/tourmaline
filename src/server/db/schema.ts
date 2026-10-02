// No `import "server-only"`: drizzle-kit loads this file outside Next.js.
import { relations, sql } from "drizzle-orm";
import { check, foreignKey, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { type Item, PRIORITIES, SPREAD_STRATEGIES } from "@/lib/items";
import type { DailyWindow } from "@/lib/time-of-day";
import type { TimeZone } from "@/lib/time-zone";

export const priorityEnum = pgEnum("priority", PRIORITIES);
export const timingEnum = pgEnum("timing", ["fixed", "flexible"] as const satisfies readonly Item["timing"][]);
export const spreadEnum = pgEnum("spread", SPREAD_STRATEGIES);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const auditColumns = {
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Single row (`id = 1`) while the app has one user. */
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    timeZone: text("time_zone").$type<TimeZone>().notNull(),
    downtimeStartMinute: integer("downtime_start_minute").notNull(),
    downtimeEndMinute: integer("downtime_end_minute").notNull(),
    ...auditColumns,
  },
  (t) => [
    check("settings_single_row", sql`${t.id} = 1`),
    check(
      "settings_downtime_minutes",
      sql`${t.downtimeStartMinute} between 0 and 1439 and ${t.downtimeEndMinute} between 0 and 1439`,
    ),
  ],
);

/**
 * Fields shared by every item. Each item has exactly one details row matching its `timing`;
 * the composite foreign keys below guarantee the kind matches, the repository guarantees the row exists.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    priority: priorityEnum("priority").notNull().default("normal"),
    timing: timingEnum("timing").notNull(),
    ...auditColumns,
  },
  (t) => [unique("items_id_timing").on(t.id, t.timing)],
);

export const fixedItemDetails = pgTable(
  "fixed_item_details",
  {
    itemId: uuid("item_id").primaryKey(),
    timing: timingEnum("timing").notNull().default("fixed"),
    startAt: timestamptz("start_at").notNull(),
    endAt: timestamptz("end_at").notNull(),
    location: text("location"),
    bufferBeforeMin: integer("buffer_before_min").notNull().default(0),
    bufferAfterMin: integer("buffer_after_min").notNull().default(0),
  },
  (t) => [
    foreignKey({ columns: [t.itemId, t.timing], foreignColumns: [items.id, items.timing] }).onDelete("cascade"),
    check("fixed_item_details_timing", sql`${t.timing} = 'fixed'`),
    check("fixed_item_details_times", sql`${t.startAt} < ${t.endAt}`),
    check("fixed_item_details_buffers", sql`${t.bufferBeforeMin} >= 0 and ${t.bufferAfterMin} >= 0`),
  ],
);

export const flexibleItemDetails = pgTable(
  "flexible_item_details",
  {
    itemId: uuid("item_id").primaryKey(),
    timing: timingEnum("timing").notNull().default("flexible"),
    durationMin: integer("duration_min").notNull(),
    earliestStart: timestamptz("earliest_start").notNull(),
    deadline: timestamptz("deadline").notNull(),
    splitMinChunkMin: integer("split_min_chunk_min"),
    splitMaxChunkMin: integer("split_max_chunk_min"),
    preferredWindows: jsonb("preferred_windows").$type<DailyWindow[]>().notNull().default([]),
    spread: spreadEnum("spread").notNull().default("even"),
  },
  (t) => [
    foreignKey({ columns: [t.itemId, t.timing], foreignColumns: [items.id, items.timing] }).onDelete("cascade"),
    check("flexible_item_details_timing", sql`${t.timing} = 'flexible'`),
    check("flexible_item_details_duration", sql`${t.durationMin} > 0`),
    check("flexible_item_details_window", sql`${t.earliestStart} < ${t.deadline}`),
    check(
      "flexible_item_details_split",
      sql`(${t.splitMinChunkMin} is null) = (${t.splitMaxChunkMin} is null) and (${t.splitMinChunkMin} is null or ${t.splitMinChunkMin} between 1 and ${t.splitMaxChunkMin})`,
    ),
  ],
);

export const itemsRelations = relations(items, ({ one }) => ({
  fixedDetails: one(fixedItemDetails),
  flexibleDetails: one(flexibleItemDetails),
}));

export const fixedItemDetailsRelations = relations(fixedItemDetails, ({ one }) => ({
  item: one(items, { fields: [fixedItemDetails.itemId], references: [items.id] }),
}));

export const flexibleItemDetailsRelations = relations(flexibleItemDetails, ({ one }) => ({
  item: one(items, { fields: [flexibleItemDetails.itemId], references: [items.id] }),
}));
