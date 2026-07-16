"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { runConversationalDiscovery } from "@/services/discovery/run-conversational-discovery";

export type SendDiscoveryMessageResult =
  | {
      ok: true;
      assistantMessage: string | null;
      turnMode: "normal" | "blockers_only" | "human_review_required";
      shouldProcess: boolean;
    }
  | { ok: false; error: string };

export async function sendDiscoveryMessageAction(input: {
  projectId: string;
  content: string;
  clientMessageId: string;
}): Promise<SendDiscoveryMessageResult> {
  const projectId = input.projectId.trim();
  const content = input.content.trim();
  const clientMessageId = input.clientMessageId.trim();

  if (!projectId || !content || !clientMessageId) {
    return { ok: false, error: "El proyecto y el mensaje son obligatorios." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const result = await runConversationalDiscovery({
    projectId,
    content,
    clientMessageId,
    userId: user.id,
    supabase,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/discovery`);
  revalidatePath(`/projects/${projectId}/agents`);

  return {
    ok: true,
    assistantMessage: result.assistantMessage,
    turnMode: result.turnMode,
    shouldProcess: result.shouldProcess,
  };
}
