import type {
  DiscoveryV2ArtifactReadinessStatus,
  DiscoveryV2ArtifactType,
  DiscoveryV2CoverageKey,
  DiscoveryV2CoverageStatus,
  DiscoveryV2IssueSeverity,
  DiscoveryV2KnowledgeType,
  DiscoveryV2KnowledgeValidationStatus,
  DiscoveryV2SessionStatus,
} from "../../domain/discovery/discovery-v2.ts";

export type DiscoveryPersistenceUuid = string;

export type DiscoverySessionRow = {
  id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  status: DiscoveryV2SessionStatus;
  summary: string;
  turn_count: number;
  soft_turn_limit: number;
  hard_turn_limit: number;
  current_coverage_score: number;
  active_turn_id: DiscoveryPersistenceUuid | null;
  active_turn_started_at: string | null;
  active_turn_user_message_id: DiscoveryPersistenceUuid | null;
  last_agent_run_id: DiscoveryPersistenceUuid | null;
  lock_version: number;
  started_by: DiscoveryPersistenceUuid | null;
  started_at: string | null;
  ready_for_review_at: string | null;
  completed_at: string | null;
  completed_by: DiscoveryPersistenceUuid | null;
  completion_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveryMessageRole = "system" | "assistant" | "user";

export type DiscoveryMessageRow = {
  id: DiscoveryPersistenceUuid;
  session_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  turn_id: DiscoveryPersistenceUuid;
  role: DiscoveryMessageRole;
  content: string;
  sequence_number: number;
  client_message_id: DiscoveryPersistenceUuid | null;
  agent_run_id: DiscoveryPersistenceUuid | null;
  correlation_id: DiscoveryPersistenceUuid | null;
  created_by: DiscoveryPersistenceUuid | null;
  created_at: string;
};

export type DiscoveryKnowledgeRow = {
  id: DiscoveryPersistenceUuid;
  session_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  external_key: string;
  knowledge_type: DiscoveryV2KnowledgeType;
  dimension: DiscoveryV2CoverageKey;
  statement: string;
  normalized_statement: string;
  validation_status: DiscoveryV2KnowledgeValidationStatus;
  confidence: number;
  source_message_ids: DiscoveryPersistenceUuid[];
  agent_run_id: DiscoveryPersistenceUuid;
  reviewed_by: DiscoveryPersistenceUuid | null;
  reviewed_at: string | null;
  review_note: string | null;
  superseded_by: DiscoveryPersistenceUuid | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveryGapStatus =
  | "open"
  | "resolved"
  | "deferred"
  | "accepted_open"
  | "superseded";

export type DiscoveryGapRow = {
  id: DiscoveryPersistenceUuid;
  session_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  external_key: string;
  dimension: DiscoveryV2CoverageKey;
  description: string;
  severity: DiscoveryV2IssueSeverity;
  status: DiscoveryGapStatus;
  affected_artifacts: DiscoveryV2ArtifactType[];
  source_message_ids: DiscoveryPersistenceUuid[];
  resolution_note: string | null;
  accepted_consequence: string | null;
  created_by_agent_run_id: DiscoveryPersistenceUuid;
  reviewed_by: DiscoveryPersistenceUuid | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveryContradictionStatus =
  | "open"
  | "resolved"
  | "dismissed"
  | "superseded";

export type DiscoveryContradictionRow = {
  id: DiscoveryPersistenceUuid;
  session_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  external_key: string;
  dimension: DiscoveryV2CoverageKey;
  statement_a: string;
  statement_b: string;
  source_message_a_id: DiscoveryPersistenceUuid;
  source_message_b_id: DiscoveryPersistenceUuid;
  severity: DiscoveryV2IssueSeverity;
  resolution_question: string;
  affected_artifacts: DiscoveryV2ArtifactType[];
  status: DiscoveryContradictionStatus;
  resolution_note: string | null;
  created_by_agent_run_id: DiscoveryPersistenceUuid;
  reviewed_by: DiscoveryPersistenceUuid | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveryCoverageRow = {
  id: DiscoveryPersistenceUuid;
  session_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  dimension: DiscoveryV2CoverageKey;
  status: DiscoveryV2CoverageStatus;
  satisfied_criteria: unknown[];
  missing_criteria: unknown[];
  not_applicable_criteria: unknown[];
  evidence: unknown[];
  rationale: string;
  confidence: number;
  evaluated_by_agent_run_id: DiscoveryPersistenceUuid | null;
  updated_at: string;
};

export type DiscoveryArtifactReadinessRow = {
  id: DiscoveryPersistenceUuid;
  session_id: DiscoveryPersistenceUuid;
  organization_id: DiscoveryPersistenceUuid;
  project_id: DiscoveryPersistenceUuid;
  artifact_type: DiscoveryV2ArtifactType;
  status: DiscoveryV2ArtifactReadinessStatus;
  agent_status: DiscoveryV2ArtifactReadinessStatus | null;
  blockers: unknown[];
  rationale: string;
  evaluated_by_agent_run_id: DiscoveryPersistenceUuid | null;
  updated_at: string;
};

export type StartDiscoveryTurnResult = {
  session_id: DiscoveryPersistenceUuid;
  turn_id: DiscoveryPersistenceUuid;
  user_message_id: DiscoveryPersistenceUuid;
  sequence_number: number;
  turn_count: number;
  turn_mode: "normal" | "blockers_only" | "human_review_required";
  should_process: boolean;
  idempotent: boolean;
};

export const discoveryPersistenceRpcNames = [
  "ensure_discovery_session",
  "start_discovery_turn",
  "record_discovery_agent_output",
  "fail_discovery_turn",
  "recover_stale_discovery_turn",
  "review_discovery_knowledge",
  "review_discovery_gap",
  "review_discovery_contradiction",
  "complete_discovery_session",
  "reopen_discovery_session",
  "get_discovery_runtime_context",
] as const;

export type DiscoveryPersistenceRpcName =
  (typeof discoveryPersistenceRpcNames)[number];

export const discoveryPersistenceErrorCodes = [
  "authentication_required",
  "project_not_found",
  "project_access_denied",
  "organization_admin_required",
  "discovery_session_not_found",
  "discovery_session_completed",
  "discovery_session_not_closed",
  "discovery_client_message_id_required",
  "discovery_invalid_message",
  "discovery_turn_in_progress",
  "discovery_stale_turn",
  "discovery_duplicate_message_mismatch",
  "discovery_hard_turn_limit_reached",
  "discovery_turn_owner_mismatch",
  "discovery_agent_run_mismatch",
  "discovery_agent_run_owner_mismatch",
  "discovery_agent_run_turn_mismatch",
  "discovery_agent_output_already_recorded",
  "discovery_invalid_prompt_version",
  "discovery_invalid_agent_output",
  "discovery_invalid_agent_output_collections",
  "discovery_invalid_coverage_output",
  "discovery_invalid_coverage_criteria",
  "discovery_invalid_coverage_status",
  "discovery_coverage_evidence_required",
  "discovery_invalid_coverage_evidence",
  "discovery_invalid_artifact_readiness_output",
  "discovery_invalid_source_message",
  "discovery_knowledge_source_required",
  "discovery_knowledge_not_found",
  "discovery_invalid_knowledge_status",
  "discovery_invalid_superseding_knowledge",
  "discovery_review_not_allowed",
  "discovery_gap_not_found",
  "discovery_invalid_gap_status",
  "discovery_accepted_consequence_required",
  "discovery_contradiction_not_found",
  "discovery_invalid_contradiction_status",
  "discovery_resolution_note_required",
  "discovery_invalid_completion_status",
  "discovery_not_ready_for_review",
  "discovery_not_ready_for_completion",
  "discovery_open_items_completion_not_allowed",
  "discovery_reopen_reason_required",
] as const;

export type DiscoveryPersistenceErrorCode =
  (typeof discoveryPersistenceErrorCodes)[number];
