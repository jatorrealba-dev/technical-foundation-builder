import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("discovery is registered as a governed project agent", async () => {
  const [domain, registry, factory] = await Promise.all([
    read("domain/agents/agent.ts"),
    read("agents/registry.ts"),
    read("agents/create-project-agent.ts"),
  ]);

  assert.match(domain, /"discovery"/);
  assert.match(registry, /promptVersion: "discovery\.v2"/);
  assert.match(factory, /outputType: discoveryAgentOutputV2Schema/);
});

test("orchestrator binds each agent run to the governed discovery turn", async () => {
  const source = await read("services/discovery/run-conversational-discovery.ts");

  assert.match(source, /"start_discovery_turn"/);
  assert.match(source, /discoverySessionId: sessionId/);
  assert.match(source, /userMessageId: turn\.user_message_id/);
  assert.match(source, /target_agent_key: "discovery"/);
  assert.match(source, /"complete_agent_run"/);
  assert.match(source, /"record_discovery_agent_output"/);
  assert.match(source, /"fail_discovery_turn"/);
});

test("client-facing discovery input forbids technical-choice questions", async () => {
  const source = await read("services/discovery/build-discovery-agent-input.ts");

  assert.match(source, /No preguntes por tecnologías/);
  assert.match(source, /situaciones, actores, decisiones, consecuencias/);
});


test("generic agent execution redirects discovery to its governed conversation", async () => {
  const [actions, page] = await Promise.all([
    read("app/projects/[projectId]/agents/actions.ts"),
    read("app/projects/[projectId]/agents/page.tsx"),
  ]);

  assert.match(actions, /agentKeyValue === "discovery"/);
  assert.ok(actions.includes("redirect(`/projects/${projectId}/discovery`)"));
  assert.match(page, /Abrir conversación/);
});
