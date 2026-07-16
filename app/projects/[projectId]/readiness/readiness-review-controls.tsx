"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  ReadinessActionStatus,
  ReadinessBlockerStatus,
} from "@/domain/readiness/readiness";

import {
  reviewReadinessActionFormAction,
  reviewReadinessBlockerFormAction,
} from "./actions";

type StatusButtonProps = {
  name: "status";
  value: string;
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
};

function StatusButton({
  name,
  value,
  label,
  variant = "default",
}: StatusButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant}
      disabled={pending}
    >
      {pending ? "Guardando..." : label}
    </Button>
  );
}

export function ReadinessBlockerReviewControls({
  projectId,
  blockerId,
  status,
  comment,
}: {
  projectId: string;
  blockerId: string;
  status: ReadinessBlockerStatus;
  comment: string | null;
}) {
  return (
    <form
      action={reviewReadinessBlockerFormAction}
      className="space-y-3 rounded-lg border bg-background p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="blockerId" value={blockerId} />

      <div>
        <label
          htmlFor={`blocker-comment-${blockerId}`}
          className="text-sm font-medium"
        >
          Comentario de revisión
        </label>
        <Textarea
          id={`blocker-comment-${blockerId}`}
          name="comment"
          defaultValue={comment ?? ""}
          maxLength={4000}
          className="mt-2 min-h-20"
          placeholder="Registra evidencia, decisión o motivo de cierre."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {status !== "accepted" ? (
          <StatusButton
            name="status"
            value="accepted"
            label="Aceptar bloqueador"
            variant="secondary"
          />
        ) : null}

        {status !== "resolved" ? (
          <StatusButton
            name="status"
            value="resolved"
            label="Marcar resuelto"
          />
        ) : null}

        {status !== "dismissed" ? (
          <StatusButton
            name="status"
            value="dismissed"
            label="Descartar"
            variant="destructive"
          />
        ) : null}

        {status !== "open" ? (
          <StatusButton
            name="status"
            value="open"
            label="Reabrir"
            variant="outline"
          />
        ) : null}
      </div>
    </form>
  );
}

export function ReadinessActionReviewControls({
  projectId,
  actionId,
  status,
  comment,
}: {
  projectId: string;
  actionId: string;
  status: ReadinessActionStatus;
  comment: string | null;
}) {
  return (
    <form
      action={reviewReadinessActionFormAction}
      className="space-y-3 rounded-lg border bg-background p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="actionId" value={actionId} />

      <div>
        <label
          htmlFor={`action-comment-${actionId}`}
          className="text-sm font-medium"
        >
          Comentario de seguimiento
        </label>
        <Textarea
          id={`action-comment-${actionId}`}
          name="comment"
          defaultValue={comment ?? ""}
          maxLength={4000}
          className="mt-2 min-h-20"
          placeholder="Registra avance, evidencia de cumplimiento o motivo de descarte."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {status !== "in_progress" ? (
          <StatusButton
            name="status"
            value="in_progress"
            label="Iniciar acción"
            variant="secondary"
          />
        ) : null}

        {status !== "completed" ? (
          <StatusButton
            name="status"
            value="completed"
            label="Marcar completada"
          />
        ) : null}

        {status !== "dismissed" ? (
          <StatusButton
            name="status"
            value="dismissed"
            label="Descartar"
            variant="destructive"
          />
        ) : null}

        {status !== "pending" ? (
          <StatusButton
            name="status"
            value="pending"
            label="Volver a pendiente"
            variant="outline"
          />
        ) : null}
      </div>
    </form>
  );
}
