/** Days a guest workspace lasts unused before it is deleted. */
export const GUEST_IDLE_DAYS = 7;

/** How long a guest's session cookie lasts; their workspace may be deleted sooner, once idle. */
export const SESSION_COOKIE_DAYS = 30;

/** The most guest workspaces kept, so crawlers can't fill the database: the least recently used go first. */
export const GUEST_WORKSPACES_KEPT = 1000;
