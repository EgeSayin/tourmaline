# Design

This document explains how Tourmaline works and why I built it this way. For each decision, I try to explain what I
chose, the problem it solves, what else I considered and what I gave up. If you haven't yet, read the
[README](../README.md) first, since it explains what the app does.

## Contents

1. [Principles](#principles)
2. [Terms](#terms)
3. [Stack](#stack)
4. [How the code is organised](#how-the-code-is-organised)
5. [Time](#time)
6. [Free time](#free-time)
7. [The scheduler](#the-scheduler)
8. [When planning happens](#when-planning-happens)
9. [Data model](#data-model)
10. [Repeating items](#repeating-items)
11. [Concurrency and isolation](#concurrency-and-isolation)
12. [Accounts and the demo](#accounts-and-the-demo)
13. [Frontend](#frontend)
14. [Testing](#testing)
15. [How the design changed](#how-the-design-changed)
16. [Known limits](#known-limits)

## Principles

Most of the decisions below come from a few principles. The first one is that the scheduler should do the thinking. I
give it my fixed schedule and my tasks, and it decides when each task happens, so anything that asks me to place,
confirm or rearrange things by hand goes against the idea of the app. Second, fixed items don't move. The scheduler
never moves them, and if two of them clash, both stay on the calendar as a conflict for me to solve.

Third, the scheduler tries to fit every task before its deadline, and priority only decides when that isn't possible. A
task that still can't fit isn't squeezed in anyway; it waits in the queue, where I can see it before its deadline.
Fourth, the plan has to be stable. Once something is planned, it stays where it is unless another task needs its time.
And finally, Tourmaline does one job, which is planning one person's week, so I only add features that help with that.

## Terms

| Term                | Meaning                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Fixed item          | Something with its own start and end, like a lecture. Never moved. Mandatory or optional.               |
| Optional fixed item | A fixed item whose time a more important task may take, when it fits nowhere else.                      |
| Buffer              | Time before or after a fixed item, like travel, that the scheduler treats as busy.                      |
| Task                | Something with a duration and a deadline. The scheduler decides when it happens.                        |
| Block               | One stretch of time the scheduler gave a task. A task can be split into several blocks.                 |
| Pending block       | A planned block that hasn't started and isn't pinned. Only pending blocks can move.                     |
| Spread              | How a task's blocks are placed: as early as possible, evenly over its window, or close to its deadline. |
| Preferred hours     | A task's time of day, kept either always (a hard rule) or only if it fits (a preference).               |
| Queue               | The tasks, or parts of tasks, that don't fit before their deadline.                                     |
| Workspace           | One person's data. Every row in the database belongs to exactly one workspace.                          |

## Stack

Tourmaline is a Next.js app that uses React server components and server actions, so there is only one app to deploy
and no separate API. Pages read the database on the server and send little JavaScript to the browser, and every change
is a typed function call from the browser to the server.

For the database, I chose PostgreSQL because I needed real relational guarantees, such as check constraints for the
rules of the data, cascading deletes, time zone conversion in SQL, row-level security and advisory locks. On top of it,
I use Drizzle ORM. The schema is written in TypeScript and is the source of truth, so the migrations and the types come
from it. Its query builder also stays close to SQL, so there is no hidden query behaviour. I had never used it before,
so this project was also my excuse to learn it.

Around these, Zod validates input, Tailwind and shadcn/ui build the interface, and Vitest, fast-check and Playwright run
the tests.

## How the code is organised

The code is split into four folders. `app/` only holds routes, `components/` holds the interface, `lib/` holds the
domain types and pure helpers that also run in the browser, and `server/` holds everything that runs only on the
server. The build also checks that the browser never imports server code, since the database client and the Temporal
helpers import `server-only`.

Every change follows the same path. A server action validates the input, a command applies the rules, and a repository
loads and saves the rows. Repositories never decide anything, and commands never write SQL, so each rule lives in one
place. For example, what happens to a series' history when it is edited is only decided in its command.

The scheduler has the strictest boundary of all. It is a set of pure functions with no database, clock or randomness,
and even "now" is passed in as a parameter. Thus, the scheduler can be deterministic, the tests can plan at any moment,
and the demo can simulate a week of history with the same code that plans a real week.

## Time

Times are stored as exact instants, and each workspace has one time zone in which they are read. I need both because
they solve different problems. Calculations like overlaps or minutes until a deadline need instants, since local times
are ambiguous. In autumn, 01:30 happens twice, and in spring, 02:30 doesn't happen at all. On the other hand, words like
"Wednesday", "18:00" or "every week" only make sense in a time zone.

So I only convert between the two where a local concept meets an instant, for example when reading a form, finding the
start of a day, expanding a repeating item or showing the calendar. The scheduler itself never sees a time zone. Days
are computed from their local midnights rather than as 24 hours, since a day with a clock change is 23 or 25 hours
long. Also, changing the time zone keeps every item's local time, so a 09:00 lecture stays at 09:00.

On the server, these conversions use Temporal, the date API built into Node 26, which handles clock changes correctly.
The browser uses `Intl` instead, since Safari doesn't support Temporal yet.

Finally, everything sits on a 5-minute grid. It keeps the search small and the calendar readable, and it works in every
real time zone, since all of their offsets are multiples of 5 minutes.

## Free time

Free time is calculated with intervals. The scheduler starts from the whole planning range and subtracts downtime, fixed
items with their buffers, and blocks that can't move. Then, each task it places subtracts its own blocks. Every input is
already an interval, so times stay exact, and the work grows with the number of events rather than the length of the
range.

I also considered splitting time into 5-minute slots, which makes searching simpler. However, the number of slots grows
with the length of the range, and buffers would have to be rounded to the grid. Interval trees only pay off with
thousands of events, and a constraint solver would be heavy and hard to follow.

Free time also has its own type, `IntervalSet`, which is always sorted, never overlapping, and never has two pieces
touching. Only the functions that merge and subtract intervals can create one, so passing an unsorted list to a search
fails at compile time instead of producing a wrong schedule. The pieces not touching is important too, since a task
that needs two adjacent free pieces together would never fit if they stayed separate.

## The scheduler

### Ranked goals

The scheduler compares plans with a ranked list of goals:

1. Place every task.
2. Keep tasks out of the time of optional fixed items.
3. Keep tasks within their preferred hours.
4. Keep already planned blocks where they are.

A goal only matters when two plans tie on every goal before it, and within each goal, a more important task comes
first. The usual alternative is to give each goal a weight and add them up. However, weights have to be tuned, and they
can't guarantee that priority always wins, since enough low priority tasks would eventually outweigh a mandatory one.
With ranked goals, one more important task always beats any number of less important ones.

I also had to decide the order of the goals. Placing every task comes first, because a task in the queue is the worst
outcome. Preferred hours come before keeping blocks where they are, so a block that loses nothing by moving gives way to
a task that wants its time. How a task is spread comes last and isn't scored at all; it only decides where each task's
own blocks go. I considered scoring it, but "evenly" has no fixed target, since its targets move with the free time that
other tasks leave. Scoring it would also have made every plan run the full search.

Many planning solvers work the same way, with a score made of ranked levels, a greedy first plan and then an
improvement search. The difference is in the improvement search, which I explain below.

### The first plan

The first plan places tasks one at a time, each into the free time the earlier ones left. The order is priority first,
then pressure, then deadline, and finally the task's id. Pressure is how much of its usable free time a task needs, so
within the same priority, a big project due in five days can come before a small homework due in three. Only stretches
long enough for one of the task's blocks count, since a 10-minute gap is no use to a 2-hour task.

Then, each task is placed according to its spread. "As early as possible" takes the earliest fit, and "close to its
deadline" takes the latest fit. The latest fit is the earliest fit on a mirrored timeline, so one search works in both
directions. "Evenly" aims each block at the middle of an equal share of the free time in the task's window, so busy days
get fewer blocks. If a task's spread finds nothing, the other spreads are tried before the task goes to the queue.

Tasks split into chunks need a more careful search, since each chunk has a minimum and maximum length and there has to
be at least 30 minutes between chunks. For these, I use a backtracking search. It goes through the free stretches in
order and tries the earliest start and the longest chunk first, and it stops early when the free time left can't hold
the rest, or when the rest can't be cut into allowed sizes. It also remembers dead ends by where the search starts and
how many minutes are left, which is all the rest of the search depends on, so it never explores the same dead end
twice. Thus, the search finds chunks whenever any exist. An earlier greedy version couldn't promise that and sometimes
missed valid layouts.

### Improving the plan

Finding the best plan is NP-hard in general, so the scheduler doesn't try every option. Instead, if the first plan
leaves a task out, puts it in an optional item's time or keeps it out of its preferred hours, the scheduler tries other
plans. Starting from the least important priority level, it removes the pending blocks of that level and below, first
only the ones in the task's way and then all of them, and places them again in a few different orders, such as by
urgency or by earliest deadline. A new plan only replaces the current best one if it is strictly better by the goals,
and the search keeps going from the winner until nothing improves.

Only accepting strict improvements is the main difference from many planning solvers, which run for a set time and
sometimes accept a worse plan to escape a local optimum. Thus, my search can stop at a good plan rather than the best
one. However, planning the same plan again changes nothing, and the result never depends on how fast the machine is. As
Tourmaline plans on every change, I think that is the better trade-off.

I also considered an exact solver, a mixed-integer program solved with HiGHS, which would find the best plan. However,
a 5-minute grid over weeks makes a huge model, keeping plans stable between runs would need extra constraints, and it is
a heavy dependency for this app.

### Determinism

The scheduler is deterministic, meaning the same tasks, fixed items, settings and saved blocks at the same moment always
give the same plan. To make sure of that, every choice the scheduler makes has a fixed order behind it. Tasks are
ordered down to their id, searches go through free time in order, and when two plans tie, the one tried first wins.

Many planning solvers aren't deterministic, as they use random search or stop after a time limit, which is fine when a
plan is made once. However, Tourmaline plans again on every change, so a random scheduler could give me a different week
every time I save something. Being deterministic also makes every plan reproducible, so I can test a bug at the exact
moment it happened.

### Stability

Each new plan starts from the last one. Blocks that are done, started, pinned or waiting for review never move. Pending
blocks are kept as long as they are still valid, which means their task still needs that time and the block is still
inside the task's window and in free time. Only the time a task still needs on top of its kept blocks gets placed
again. So adding a task usually changes nothing else, and blocks only move when another task needs their time.

When something frees time, like deleting an item, skipping an occurrence or shortening a task, nothing is planned again
either. That time becomes free time, or a queued task that fits takes it. I decided this after measuring the
alternative. Before, such a change dropped every pending block and planned the week from scratch, so that tasks could
move into the freed time. To see how much that moved, I ran 200 made-up two-week scenarios, built them up one task at a
time, and deleted a Thursday evening event on a Tuesday:

| After deleting the Thursday event              | Tasks moved (of about 15) | Of those, entirely before Thursday |
| ---------------------------------------------- | ------------------------- | ---------------------------------- |
| Plan the week from scratch (the old behaviour) | 9.5 on average            | 4.7                                |
| Plan again only from Thursday evening on       | 4.3                       | 0                                  |
| Keep every planned block (the new behaviour)   | 0                         | 0                                  |

Most of the moves had nothing to do with the freed time. A plan built up over time differs from a fresh plan of the same
week in about 9 of its 15 tasks, so throwing the plan away reshuffles the week whatever was deleted. Planning again only
from Thursday evening kept everything before it in place, but evenly spread tasks after it still shifted, since their
targets move with any change in the free time of their window. Keeping every block moved nothing. The cost is that a
task spread as early as possible doesn't move earlier into the freed time, and a task squeezed in close to its deadline
keeps its tight spot. I accepted that, since stability matters more to me, and I can still edit a task to move it.

### Layers

Overall, the scheduler is built in four layers, so the goals and the search methods don't get mixed up:

1. **Where a task may go.** This is the free time, cut to the task's own hard limits, which are its window, its
   preferred hours when it must keep to them, and the optional fixed items it isn't more important than. Every part of
   the scheduler asks the same function, so a new hard rule only needs one change.
2. **What makes a plan better.** These are the ranked goals.
3. **What a task gives up when it doesn't fit.** It follows the goals from the bottom, so a task first gives up its
   spread, then its preferences, then other tasks' blocks are moved for it, and finally it waits in the queue.
4. **How plans are searched.** This is the first plan and the improvement search. They only look for good plans, and
   the goals decide what counts as better.

Before this split, the order in which the code ran decided which rule won, so adding a rule meant editing the middle of
the planner. Now, a new hard rule goes into layer 1, and a new soft rule is one more entry in the list of goals.

## When planning happens

Every change plans again in the same database transaction, and page loads only read the saved plan. The only exception
is the first page load of each local day, which plans first, since each new day brings the next occurrences of repeating
tasks into range. Otherwise, time passing can't make room for anything new, so there is nothing to plan again for.

The plan covers everything up to the latest one-off deadline, but repeating tasks are only planned up to 28 days ahead,
so a far-off deadline doesn't pull months of daily occurrences into every plan. Also, a plan is only saved if its
pending blocks changed, so most changes don't write anything.

The queue isn't stored either. It is calculated when read, as each planned task's duration minus the time its blocks
hold. An earlier version kept it in a table, but that was really a cache that could go out of date. Blocks, on the
other hand, have to be stored, because they hold what I did with them, and each plan builds on the last.

## Data model

Fixed items and tasks only share a few columns, like the title, priority, repeat rule and category, and everything else
is different. Storing two kinds of rows like this is a common problem for relational databases, and there are four
standard ways to do it. I went through three of them:

1. **A base table with a detail table per kind.** The tables were clean, but every load joined three tables, and
   changing an item's kind moved a row between detail tables.
2. **One table with the columns of both kinds**, all nullable, and a check constraint requiring exactly one kind's
   columns. There were no joins, but the table was harder to read, nullability no longer described the data, the check
   had to follow every column change, and the ORM typed every kind's columns as nullable.
3. **JSON details.** I rejected this one without building it, since it loses column types and constraints.
4. **A complete table per kind**, `fixed_items` and `tasks`, with no base table. This is the current design.

The last one fits because the code already uses the two kinds separately. The calendar reads fixed items, and the
scheduler reads tasks. Each table also states its own rules, like `tasks.deadline NOT NULL`, without check constraints
to keep in sync. Foreign keys got more precise too, since blocks only reference `tasks`, so the database itself makes
sure a fixed item never has blocks. The costs are that changing an item's kind means deleting it and inserting it
again, which the edit flow already handled, and that looking up an item by id has to check both tables.

The database only stores whether a block is planned, done or missed, since those are my decisions. States like "in
progress" or "waiting for review" are calculated from the current time, so no background job has to update them.

The database also repeats the rules of the data as constraints, like durations on the grid, a start before an end, and
one block per task and start time. The parser gives good error messages, while the database makes sure no path, whether
a script or a bug, can save an invalid row. The values these rules use, like the 5-minute grid, come from one
TypeScript constant, so they can't drift apart. A few rules have to exist in both SQL and TypeScript, like whether a
block is pending, since SQL needs it to delete rows in bulk and the scheduler needs it in memory. These are kept as
pairs, and a property test checks against the real database that each pair agrees.

## Repeating items

A series is stored once, as one row and a rule, and expanded into occurrences when read. This is the same model
iCalendar uses. The rule only decides which dates occur, and the item's own start sets the first date and the time of
day. Only occurrences with something of their own, like being skipped, done or changed, get a row.

Each occurrence is identified by its date. At first, I suggested numbering occurrences instead, so a skipped one would
be "number 4". However, that breaks in several places. Editing the rule renumbers every occurrence, splitting a series
starts the new one from zero, and blocks need to point at the same occurrence across edits. Dates stay the same through
all of these, so an occurrence's id is the item's id plus its local date, which is the same idea as iCalendar's
`RECURRENCE-ID`.

One occurrence can also be changed on its own, but only its timing, meaning a fixed occurrence's start and end, or a
task occurrence's duration and window. It keeps its original date as its id, so skipping or resetting it still works.
Storing these as rows rather than as JSON on the series means the database checks them and row-level security covers
them.

When I edit a series from a later date, the old series ends the day before, and the edit is saved as a new series, so
the past stays as it happened. This is how most calendar apps handle it too.

A repeating task is due when its next occurrence starts, like doing the laundry sometime before the next laundry.
However, some tasks shouldn't carry over like that. For example, missing lunch doesn't mean I should eat twice the next
day. For those, a task can be kept within its own day or week, so a missed occurrence is only planned again inside that
period.

## Concurrency and isolation

Every request runs in one transaction, so a change, the plan it causes and the saved result either all happen or none
of them do. Thus, the plan is never out of date with the data.

Planning also runs one at a time per workspace. Otherwise, two tabs or a double click could build two plans from data
the other one is changing. To prevent this, every change takes a transaction-level advisory lock on its workspace. It
is released with the transaction, doesn't lock any rows and doesn't affect other workspaces. I chose it over the
serializable isolation level, which would need retry logic around every change, and over locking the workspace row,
which would conflict with other queries on it. Page loads don't take the lock, and read one consistent snapshot
instead.

Workspaces are separated in two places. Every query is scoped to the request's workspace in the code, and the database
enforces the same with row-level security. Each transaction runs as a database role whose policies only allow rows of
the workspace it set. A test also checks that every table with workspace data has these policies, so a new table can't
miss them.

## Accounts and the demo

I kept accounts simple. Several people can share one instance, each with one private workspace, and they sign in with a
username and password. Passwords are hashed with scrypt from Node's standard library, and each hash records its own
settings, so they can change later. I didn't add an auth library, since sessions already existed for the demo. The
first account becomes the admin, and sign-up is closed after that until the admin opens it. After 5 wrong passwords in a
row, sign-in pauses for a minute, and the pause doubles with each further wrong one, up to a day. There is no email, so
the server owner resets forgotten passwords with a command.

A session is a random 256-bit token in an HTTP-only cookie, and the database only stores its SHA-256 hash, so a leaked
table can't be used to sign in. A slow hash isn't needed here, since a random token can't be guessed the way a password
can.

The demo gives each visitor a private guest workspace with a sample week, without accounts, and it stores nothing about
visitors except the hash of their session token. Instead of a scheduled cleanup job, old guest workspaces are deleted
whenever a new demo starts, namely the ones unused for 7 days and any beyond the 1,000 most recently used.

The sample week also has a simulated history. It is built around today and planned with "now" set to its first
morning. Then, the blocks that have ended since are marked done, the latest one is left for review, one is marked
missed, and the week is planned again from the real now. So the demo starts in the same state real use would have
produced. This only works because the scheduler is pure and takes "now" as a parameter.

## Frontend

Pages are React server components, and only the interactive parts run in the browser. The server prepares each page's
data ready to show, so the browser only renders it. What is selected also lives in the URL, so opening an item is a
link, the back button closes it, and the server renders it already filled in.

Phones and desktops get the same page. CSS decides what is shown, and the number of days on the calendar comes from a
CSS variable, so there is no layout code in JavaScript and nothing jumps when the page loads. Finally, validation only
happens on the server, so there is one source of rules. Forms send plain form data, and errors come back with the
values that were entered, so nothing typed is lost.

## Testing

I prefer a few scenario tests over many small ones, each testing behaviour at the highest level that pins it down.
Database tests run against a real Postgres inside a transaction that is rolled back afterwards, so they use real SQL,
constraints and locks, without mocks or cleanup. Where a guarantee is easy to state but hard to get right, like the
interval arithmetic, the searches, planning, repeating items and the calendar layout, I use property-based tests with
fast-check. On top of these, Playwright runs end-to-end tests on desktop and phone, written to pass whatever day and
time they run.

## How the design changed

I reviewed the design many times along the way, and some of the biggest changes were removing things.

Focus caps, a daily maximum of planned time, were removed. They conflicted with the main goal of finishing tasks
before their deadlines, they were the most complex part of the scheduler, and they made planning two to three times
slower. If I want a free evening, I can add a fixed item for it instead. Preferred hours were also removed at first,
because of the complexity they added. They came back later as one rule with two strengths, once the layered scheduler
had a clean place for them. Similarly, I removed a prompt that asked what to do when two fixed items clashed. Since
fixed items don't move, a conflict is only shown, and I solve it myself.

## Known limits

- The scheduler can stop at a good plan rather than the best one, since it only accepts strict improvements.
- A task spread as early as possible doesn't move earlier when time frees up.
- A block that crosses midnight is cut at the end of its first day on the calendar. This only affects how it is shown.
- Every page load reads all of a workspace's items. That is fine at personal scale, but it wouldn't be for very large
  workspaces.
