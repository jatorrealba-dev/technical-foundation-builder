import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..");

const pagePath = resolve(
  projectRoot,
  "app/organizations/[organizationId]/settings/ai/page.tsx"
);

test(
  "AI settings renders usage values without ProgressValue across the RSC boundary",
  async () => {
    const source = await readFile(pagePath, "utf8");

    assert.equal(
      source.includes("ProgressValue"),
      false,
      "The Server Component must not import or render ProgressValue."
    );

    assert.match(
      source,
      /formatNumber\(usage\.monthly_total_tokens\)/,
      "Monthly token consumption must remain visible."
    );

    assert.match(
      source,
      /formatNumber\(policy\.monthly_token_limit\)/,
      "Monthly token limit must remain visible."
    );

    assert.match(
      source,
      /usage\.current_user_daily_runs/,
      "Daily run consumption must remain visible."
    );

    assert.match(
      source,
      /policy\.daily_run_limit_per_user/,
      "Daily run limit must remain visible."
    );
  }
);
