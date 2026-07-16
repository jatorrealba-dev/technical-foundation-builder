"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgentApplicationStatus,
  AgentKey,
  AgentReviewDecision,
} from "@/domain/agents/agent";

import {
  createAgentChangeSetFormAction,
  reviewAgentRunFormAction,
} from "./actions";

type AgentRunReviewControlsProps = {
  projectId: string;
  runId: string;
  agentKey: AgentKey;
  decision: AgentReviewDecision;
  reviewerComment: string | null;
  applicationStatus: AgentApplicationStatus;
  canManage: boolean;
  changeSetId: string | null;
};

type ReviewDecisionButtonProps = {
  decision: "approved" | "rejected";
  label: string;
  variant?: "default" | "destructive";
};

function ReviewDecisionButton({
  decision,
  label,
  variant = "default",
}: ReviewDecisionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      variant={variant}
      disabled={pending}
    >
      {pending ? "Guardando revisión..." : label}
    </Button>
  );
}

function PrepareChangeSetButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? "Preparando propuesta..."
        : "Preparar revisión granular"}
    </Button>
  );
}

export function AgentRunReviewControls({
  projectId,
  runId,
  agentKey,
  decision,
  reviewerComment,
  applicationStatus,
  canManage,
  changeSetId,
}: AgentRunReviewControlsProps) {
  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Puedes consultar esta revisión, pero solo un owner o
        admin de la organización puede aprobar, rechazar o
        aplicar resultados de IA.
      </p>
    );
  }

  const isApplied = applicationStatus === "applied";
  const isApplying = applicationStatus === "applying";
  const canPrepareChangeSet =
    agentKey === "project_model" &&
    decision === "approved" &&
    !isApplied &&
    !isApplying;

  return (
    <div className="space-y-5">
      {isApplying ? (
        <div className="rounded-lg border border-amber-500/60 bg-amber-500/5 p-4">
          <p className="font-medium">Aplicación en progreso</p>
          <p className="mt-1 text-sm text-muted-foreground">
            La base de datos está aplicando una propuesta
            revisada de forma transaccional.
          </p>
        </div>
      ) : null}

      {!isApplied && !isApplying && !changeSetId ? (
        <form
          action={reviewAgentRunFormAction}
          className="space-y-3 rounded-lg border p-4"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="runId" value={runId} />

          <div>
            <label
              htmlFor={`review-comment-${runId}`}
              className="text-sm font-medium"
            >
              Comentario del revisor
            </label>

            <Textarea
              id={`review-comment-${runId}`}
              name="reviewerComment"
              defaultValue={reviewerComment ?? ""}
              maxLength={4000}
              className="mt-2 min-h-24"
              placeholder="Explica la aprobación, el rechazo o los ajustes que deben revisarse."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <ReviewDecisionButton
              decision="approved"
              label="Aprobar resultado"
            />

            <ReviewDecisionButton
              decision="rejected"
              label="Rechazar resultado"
              variant="destructive"
            />
          </div>
        </form>
      ) : null}

      {changeSetId && !isApplied ? (
        <p className="text-sm text-muted-foreground">
          La decisión general quedó fijada al crear la propuesta.
          Revisa y decide cada cambio dentro del flujo granular.
        </p>
      ) : null}

      {canPrepareChangeSet ? (
        <div className="space-y-4 rounded-lg border border-amber-500/60 bg-amber-500/5 p-4">
          <div>
            <p className="font-medium">
              Gobernanza del Project Model
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Convierte la salida aprobada en cambios
              individuales. Podrás aceptar o rechazar cada uno
              antes de aplicar y regenerar únicamente los
              documentos afectados.
            </p>
          </div>

          {changeSetId ? (
            <Button asChild>
              <Link
                href={`/projects/${projectId}/analysis/change-sets/${changeSetId}`}
              >
                Abrir propuesta de cambios
              </Link>
            </Button>
          ) : (
            <form action={createAgentChangeSetFormAction}>
              <input
                type="hidden"
                name="projectId"
                value={projectId}
              />
              <input type="hidden" name="runId" value={runId} />
              <PrepareChangeSetButton />
            </form>
          )}
        </div>
      ) : null}

      {decision === "approved" && agentKey === "consistency" ? (
        <div className="space-y-3 rounded-lg border border-amber-500/60 bg-amber-500/5 p-4">
          <div>
            <p className="font-medium">
              Hallazgos listos para gobernanza
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Importa esta salida en Consistency Engine para
              deduplicar hallazgos, revisar su estado y conservar
              el historial de cada decisión.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/consistency`}>
              Abrir Consistency Engine
            </Link>
          </Button>
        </div>
      ) : null}

      {decision === "approved" &&
      agentKey !== "project_model" &&
      agentKey !== "consistency" ? (
        <p className="text-sm text-muted-foreground">
          Esta ejecución fue aprobada como recomendación
          informativa. No modifica automáticamente el Project
          Model ni los documentos.
        </p>
      ) : null}
    </div>
  );
}
