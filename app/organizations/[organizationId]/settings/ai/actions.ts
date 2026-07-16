"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAiRuntimeErrorMessage } from "@/domain/operations/ai-governance";
import { createClient } from "@/lib/supabase/server";

function getSettingsPath(organizationId: string): string {
  return `/organizations/${organizationId}/settings/ai`;
}

function parseInteger(
  value: FormDataEntryValue | null,
  fallback: number
): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function updateOrganizationAiPolicyAction(
  formData: FormData
) {
  const organizationId = String(
    formData.get("organizationId") ?? ""
  ).trim();

  if (!organizationId) {
    redirect("/dashboard");
  }

  const settingsPath = getSettingsPath(organizationId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc(
    "update_organization_ai_policy",
    {
      target_organization_id: organizationId,
      target_ai_enabled:
        formData.get("aiEnabled") === "on",
      target_daily_run_limit_per_user: parseInteger(
        formData.get("dailyRunLimitPerUser"),
        20
      ),
      target_monthly_token_limit: parseInteger(
        formData.get("monthlyTokenLimit"),
        1_000_000
      ),
      target_max_concurrent_runs_per_user: parseInteger(
        formData.get("maxConcurrentRunsPerUser"),
        1
      ),
      target_max_concurrent_runs_per_project_agent: parseInteger(
        formData.get("maxConcurrentRunsPerProjectAgent"),
        1
      ),
      target_run_timeout_seconds: parseInteger(
        formData.get("runTimeoutSeconds"),
        180
      ),
    }
  );

  if (error) {
    redirect(
      `${settingsPath}?error=${encodeURIComponent(
        getAiRuntimeErrorMessage(error.message)
      )}`
    );
  }

  revalidatePath(settingsPath);
  revalidatePath(`/organizations/${organizationId}/team`);

  redirect(`${settingsPath}?updated=1`);
}

export async function recoverStaleAgentRunsAction(
  formData: FormData
) {
  const organizationId = String(
    formData.get("organizationId") ?? ""
  ).trim();

  if (!organizationId) {
    redirect("/dashboard");
  }

  const settingsPath = getSettingsPath(organizationId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc(
    "recover_stale_agent_runs",
    {
      target_organization_id: organizationId,
    }
  );

  if (error) {
    redirect(
      `${settingsPath}?error=${encodeURIComponent(
        getAiRuntimeErrorMessage(error.message)
      )}`
    );
  }

  revalidatePath(settingsPath);

  redirect(
    `${settingsPath}?recovered=${encodeURIComponent(
      String(data ?? 0)
    )}`
  );
}
