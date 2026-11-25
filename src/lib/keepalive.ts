// GitHub disables a public repository's schedules after 60 days without activity.
// The scheduled run commits a timestamp once master is older than this.
export const KEEPALIVE_AFTER_DAYS = 50;

const DAY_MS = 86_400_000;

/** True when the last commit on master is more than 50 days older than `now`. */
export function shouldKeepAlive(lastCommitIso: string, now: Date): boolean {
  const last = new Date(lastCommitIso).getTime();
  if (Number.isNaN(last)) {
    throw new Error(`Cannot read the last commit date: "${lastCommitIso}"`);
  }
  return now.getTime() - last > KEEPALIVE_AFTER_DAYS * DAY_MS;
}
