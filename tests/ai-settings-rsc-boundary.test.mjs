import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL(
  "../app/organizations/[organizationId]/settings/ai/page.tsx",
  import.meta.url
);

test("AI settings does not pass render functions from a Server Component to ProgressValue", async () => {
  const source = await readFile(pagePath, "utf8");
  const progressValueBlocks = [
    ...source.matchAll(/<ProgressValue>([\s\S]*?)<\/ProgressValue>/g),
  ];

  assert.equal(progressValueBlocks.length, 2);

  for (const [, children] of progressValueBlocks) {
    assert.doesNotMatch(children, /\{\s*\(\)\s*=>/);
  }
});
