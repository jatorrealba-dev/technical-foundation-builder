"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { DiscoveryMessageRow } from "@/services/discovery/discovery-persistence";

import { sendDiscoveryMessageAction } from "./actions";

export function DiscoveryClient(input: {
  projectId: string;
  initialMessages: DiscoveryMessageRow[];
  sessionStatus: string;
  coverageScore: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError("");

    try {
      const result = await sendDiscoveryMessageAction({
        projectId: input.projectId,
        content,
        clientMessageId: crypto.randomUUID(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft("");
      router.refresh();
    } catch {
      setError("No fue posible enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Discovery conversacional v2</Badge>
        <Badge variant="outline">{input.sessionStatus}</Badge>
        <Badge variant="outline">Cobertura {Math.round(input.coverageScore)}%</Badge>
      </div>

      <div className="space-y-3">
        {input.initialMessages.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Describe tu idea con tus propias palabras. El analista hará una sola
              pregunta a la vez y traducirá tus respuestas a una base técnica sin
              pedirte que elijas tecnologías.
            </CardContent>
          </Card>
        ) : (
          input.initialMessages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-3xl rounded-xl bg-primary px-4 py-3 text-primary-foreground"
                  : "mr-auto max-w-3xl rounded-xl border bg-card px-4 py-3"
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Explica tu idea, responde la pregunta o aclara una decisión..."
          rows={5}
          maxLength={20000}
          disabled={sending || input.sessionStatus.startsWith("completed")}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "Analizando..." : "Enviar respuesta"}
          </Button>
        </div>
      </form>
    </div>
  );
}
