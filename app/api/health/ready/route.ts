import { NextResponse } from "next/server";

import { getAiConfigurationStatus } from "@/lib/ai/config";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { sanitizeOperationalError } from "@/lib/runtime/error-sanitization";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const ai = getAiConfigurationStatus();

  try {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc(
      "platform_readiness_check"
    );

    if (error) {
      throw new Error(error.message);
    }

    const aiReady = !ai.enabled || ai.ready;
    const status = aiReady ? "ready" : "degraded";

    return NextResponse.json(
      {
        status,
        checkedAt,
        database: data,
        ai: {
          enabled: ai.enabled,
          configured: ai.ready,
          model: ai.model,
        },
      },
      {
        status: aiReady ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        checkedAt,
        error: sanitizeOperationalError(
          error,
          "No se pudo verificar la disponibilidad de la plataforma."
        ),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
