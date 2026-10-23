export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

/** Lowercase letters, digits, dots, dashes and underscores; the database checks it too. */
export const USERNAME_PATTERN = new RegExp(`^[a-z0-9._-]{${USERNAME_MIN},${USERNAME_MAX}}$`);

export const PASSWORD_MIN = 8;
/** Long enough for any passphrase, short enough that hashing a submitted one stays cheap. */
export const PASSWORD_MAX = 256;

export interface Account {
  id: string;
  username: string;
  isAdmin: boolean;
}
