import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoveryPersistenceErrorCodes,
  discoveryPersistenceRpcNames,
} from "../services/discovery/discovery-persistence.ts";

const migrationPath = new URL(
  "../supabase/migrations/0015_conversational_discovery_v2.sql",
  import.meta.url
);
const verificationPath = new URL(
  "../supabase/tests/0015_conversational_discovery_v2_verification.sql",
  import.meta.url
);

async function readMigration() {
  return readFile(migrationPath, "utf8");
}

test("migration creates the complete governed discovery persistence model", async () => {
  const migration = await readMigration();
  const tables = [
    "discovery_sessions",
    "discovery_messages",
    "discovery_knowledge",
    "discovery_gaps",
    "discovery_contradictions",
    "discovery_coverage",
    "discovery_artifact_readiness",
    "discovery_events",
  ];

  for (const table of tables) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`)
    );
  }
});

test("authenticated clients receive read access but no direct discovery writes", async () => {
  const migration = await readMigration();

  assert.match(
    migration,
    /revoke all privileges on table[\s\S]+from anon, authenticated;/
  );
  assert.match(
    migration,
    /grant select on table[\s\S]+to authenticated;/
  );
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete)[\s\S]+discovery_/i
  );
});

test("all public discovery mutations are exposed only through governed RPCs", async () => {
  const migration = await readMigration();

  for (const rpc of discoveryPersistenceRpcNames) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${rpc}\\(`)
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${rpc}\\(`)
    );
  }
});

test("turn persistence is idempotent and concurrency guarded", async () => {
  const migration = await readMigration();

  assert.match(migration, /unique \(session_id, client_message_id\)/);
  assert.match(migration, /for update;/i);
  assert.match(migration, /discovery_turn_in_progress/);
  assert.match(migration, /discovery_stale_turn/);
  assert.match(migration, /discovery_duplicate_message_mismatch/);
  assert.match(migration, /active_turn_id/);
  assert.match(migration, /lock_version = lock_version \+ 1/);
});

test("discovery agent runs require discovery.v2 and a completed governed run", async () => {
  const migration = await readMigration();

  assert.match(migration, /agent_key in \([\s\S]*'discovery'/);
  assert.match(migration, /target_run\.agent_key <> 'discovery'/);
  assert.match(migration, /target_run\.prompt_version <> 'discovery\.v2'/);
  assert.match(migration, /target_run\.status <> 'completed'/);
  assert.match(migration, /discovery_agent_output_already_recorded/);
});

test("database recalculates artifact readiness instead of trusting agent status", async () => {
  const migration = await readMigration();

  assert.match(
    migration,
    /create or replace function public\.refresh_discovery_artifact_readiness/
  );
  assert.match(migration, /agent_status = output_item->>'status'/);
  assert.match(
    migration,
    /perform public\.refresh_discovery_artifact_readiness\([\s\S]+target_run\.id/
  );
  assert.match(migration, /when 'blocked' then/);
  assert.match(migration, /when 'insufficient' then/);
});

test("session completion is independently guarded by coverage and open issues", async () => {
  const migration = await readMigration();

  assert.match(migration, /core_incomplete_count/);
  assert.match(migration, /missing_dimension_count/);
  assert.match(migration, /critical_open_count/);
  assert.match(migration, /open_contradiction_count/);
  assert.match(migration, /usable_artifact_count < 6/);
  assert.match(migration, /total_usable_artifact_count <> 8/);
  assert.match(migration, /discovery_not_ready_for_review/);
  assert.match(migration, /discovery_not_ready_for_completion/);
  assert.match(migration, /discovery_open_items_completion_not_allowed/);
});

test("members can review only knowledge traced entirely to their own messages", async () => {
  const migration = await readMigration();

  assert.match(migration, /owns_all_sources/);
  assert.match(migration, /created_by = auth\.uid\(\)/);
  assert.match(migration, /discovery_review_not_allowed/);
  assert.match(migration, /organization_admin_required/);
});

test("persistence error registry includes the runtime control failures", () => {
  for (const code of [
    "discovery_turn_in_progress",
    "discovery_stale_turn",
    "discovery_agent_run_mismatch",
    "discovery_not_ready_for_completion",
  ]) {
    assert.ok(discoveryPersistenceErrorCodes.includes(code));
  }
});

test("verification script covers schema, RPCs, RLS and schema version", async () => {
  const verification = await readFile(verificationPath, "utf8");

  assert.match(verification, /discovery_sessions/);
  assert.match(verification, /record_discovery_agent_output/);
  assert.match(verification, /rowsecurity/);
  assert.match(verification, /platform_readiness_check/);
  assert.match(verification, /0015/);
});

test("database validates every coverage criterion and traceable evidence", async () => {
  const migration = await readMigration();

  assert.match(migration, /create or replace function public\.discovery_v2_criteria/);
  assert.match(migration, /discovery_invalid_coverage_criteria/);
  assert.match(migration, /discovery_invalid_coverage_status/);
  assert.match(migration, /discovery_coverage_evidence_required/);
  assert.match(migration, /discovery_invalid_coverage_evidence/);
  assert.match(migration, /and role = 'user'/);
});

test("not applicable coverage is limited to roles and integrations", async () => {
  const migration = await readMigration();

  assert.match(
    migration,
    /create or replace function public\.discovery_v2_not_applicable_dimensions\(\)/
  );
  assert.match(migration, /array\['roles', 'integrations'\]::text\[\]/);
  assert.match(migration, /char_length\(trim\(output_item->>'rationale'\)\) < 20/);
});

test("database readiness matches the domain rule for partial evidence", async () => {
  const migration = await readMigration();

  assert.match(
    migration,
    /elsif partial_count > 0 or high_count > 0 then\s+next_status := 'usable';/
  );
  assert.doesNotMatch(
    migration,
    /elsif partial_count > 0 or high_count > 0 then\s+next_status := 'insufficient';/
  );
});

test("hard turn limit records the response but stops additional AI processing", async () => {
  const migration = await readMigration();

  assert.match(migration, /'turn\.human_review_required'/);
  assert.match(
    migration,
    /next_turn_mode <> 'human_review_required',\s+false;/
  );
  assert.match(
    migration,
    /target_session\.turn_count,\s+'human_review_required',\s+false,\s+true;/
  );
});

test("a discovery run is bound to the exact session turn and user message", async () => {
  const migration = await readMigration();

  assert.match(migration, /input_snapshot->>'discoverySessionId'/);
  assert.match(migration, /input_snapshot->>'turnId'/);
  assert.match(migration, /input_snapshot->>'userMessageId'/);
  assert.match(migration, /discovery_agent_run_turn_mismatch/);
});

test("reviewed discovery records cannot be silently rewritten by later agent output", async () => {
  const migration = await readMigration();

  assert.match(
    migration,
    /where public\.discovery_knowledge\.reviewed_at is null;/
  );
  assert.match(
    migration,
    /where public\.discovery_gaps\.status <> 'accepted_open';/
  );
  assert.match(
    migration,
    /where public\.discovery_contradictions\.reviewed_at is null;/
  );
});

test("persistence error registry mirrors the strengthened database contract", () => {
  for (const code of [
    "discovery_invalid_prompt_version",
    "discovery_agent_run_turn_mismatch",
    "discovery_invalid_coverage_criteria",
    "discovery_invalid_coverage_status",
    "discovery_coverage_evidence_required",
    "discovery_invalid_coverage_evidence",
  ]) {
    assert.ok(discoveryPersistenceErrorCodes.includes(code));
  }
});
