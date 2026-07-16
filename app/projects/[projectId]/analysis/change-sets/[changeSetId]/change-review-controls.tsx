"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectModelChangeDecision } from "@/domain/project-model/project-model-governance";

import { reviewProjectModelChangeFormAction } from "./actions";

type ChangeReviewControlsProps = {
  projectId: string;
  changeSetId: string;
  changeId: string;
  decision: ProjectModelChangeDecision;
  reviewerComment: string | null;
  disabled: boolean;
};

function DecisionButton({
  value,
  label,
  variant = "default",
}: {
  value: "accepted" | "rejected";
  label: string;
  variant?: "default" | "destructive";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name="decision"
      value={value}
      variant={variant}
      disabled={pending}
    >
      {pending ? "Guardando..." : label}
    </Button>
  );
}

export function ChangeReviewControls({
  projectId,
  changeSetId,
  changeId,
  decision,
  reviewerComment,
  disabled,
}: ChangeReviewControlsProps) {
  if (disabled) {
    return null;
  }

  return (
    <form
      action={reviewProjectModelChangeFormAction}
      className="space-y-3 rounded-lg border bg-background p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="changeSetId" value={changeSetId} />
      <input type="hidden" name="changeId" value={changeId} />

      <Textarea
        name="reviewerComment"
        defaultValue={reviewerComment ?? ""}
        maxLength={4000}
        className="min-h-20"
        placeholder="Comentario opcional para este cambio."
      />

      <div className="flex flex-wrap gap-3">
        <DecisionButton
          value="accepted"
          label={decision === "accepted" ? "Mantener aceptado" : "Aceptar cambio"}
        />
        <DecisionButton
          value="rejected"
          label={decision === "rejected" ? "Mantener rechazado" : "Rechazar cambio"}
          variant="destructive"
        />
      </div>
    </form>
  );
}
