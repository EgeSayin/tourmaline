import { toast } from "sonner";

/** An action failed: nothing was saved. */
export const toastNotSaved = () => toast.error("Couldn't save the change. Try again.");

/** An action found what it acted on changed or gone since the page was shown, and changed nothing. */
export const toastChangedMeanwhile = () => toast("This changed in the meantime. Showing the latest.");
