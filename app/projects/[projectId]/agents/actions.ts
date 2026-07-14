"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAgentKey } from "@/domain/agents/agent";
import { createClient } from "@/lib/supabase/server";
import { executeProjectAgent } from "@/services/agents/run-project-agent";

export async function runProjectAgentFormAction(
  formData: FormData
) {
  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const agentKeyValue = String(
    formData.get("agentKey") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  const agentsPath =
    `/projects/${projectId}/agents`;

  if (!isAgentKey(agentKeyValue)) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        "El agente seleccionado no es válido."
      )}`
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const result = await executeProjectAgent({
    projectId,
    agentKey: agentKeyValue,
    userId: user.id,
    supabase,
  });

  if (!result.ok) {
    redirect(
      `${agentsPath}?error=${encodeURIComponent(
        result.error
      )}`
    );
  }

  revalidatePath(agentsPath);
  revalidatePath(`/projects/${projectId}`);

  redirect(
    `${agentsPath}?run=${encodeURIComponent(
      result.runId
    )}`
  );
}
