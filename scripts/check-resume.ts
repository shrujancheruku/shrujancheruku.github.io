// The resume drift check: fails when a resume-only description was written from
// site wording that has since changed. Runs in the pre-commit hook, in CI and
// at the start of `bun run build`.
import { driftIn } from "../src/lib/resume";
import { education, timeline } from "../src/lib/timeline";

const drift = driftIn([...timeline, ...education.roles]);
if (drift.length > 0) {
  for (const d of drift) {
    console.error(
      `✗ resume wording for ${d.entry} was written from site wording ${d.recorded}, which is now ${d.current}`,
    );
  }
  console.error(
    "  Compare the two descriptions in src/lib/timeline.ts, then update the `resume` wording or re-confirm it by setting `from` to the current fingerprint.",
  );
  process.exit(1);
}
console.log("✓ resume wording agrees with the site wording");
