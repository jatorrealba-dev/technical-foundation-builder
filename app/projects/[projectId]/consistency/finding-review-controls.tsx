"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConsistencyFindingStatus } from "@/domain/consistency/consistency";

import { reviewConsistencyFindingFormAction } from "./actions";

type FindingReviewControlsProps = {
  projectId: string;
  findingId: string;
  status: ConsistencyFindingStatus;
  resolutionComment: string | null;
};

type StatusButtonProps = {
  status: ConsistencyFindingStatus;
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
};

function StatusButton({
  status,
  label,
  variant = "default",
}: StatusButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name="status"
      value={status}
      variant={variant}
      disabled={pending}
    >
      {pending ? "Guardando..." : label}
    </Button>
  );
}

export function FindingReviewControls({
  projectId,
  findingId,
  status,
  resolutionComment,
}: FindingReviewControlsProps) {
  return (
    <form
      action={reviewConsistencyFindingFormAction}
      className="space-y-3 rounded-lg border bg-background p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="findingId" value={findingId} />

      <div>
        <label
          htmlFor={`finding-comment-${findingId}`}
          className="text-sm font-medium"
        >
          Comentario de resolución
        </label>

        <Textarea
          id={`finding-comment-${findingId}`}
          name="comment"
          defaultValue={resolutionComment ?? ""}
          maxLength={4000}
          className="mt-2 min-h-20"
          placeholder="Documenta la decisión, evidencia de resolución o motivo de descarte."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {status !== "accepted" ? (
          <StatusButton
            status="accepted"
            label="Aceptar hallazgo"
            variant="secondary"
          />
        ) : null}

        {status !== "resolved" ? (
          <StatusButton
            status="resolved"
            label="Marcar resuelto"
          />
        ) : null}

        {status !== "dismissed" ? (
          <StatusButton
            status="dismissed"
            label="Descartar"
            variant="destructive"
          />
        ) : null}

        {status !== "open" ? (
          <StatusButton
            status="open"
            label="Reabrir"
            variant="outline"
          />
        ) : null}
      </div>
    </form>
  );
}
