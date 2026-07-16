"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type CopyToClipboardButtonProps = {
  value: string;
  idleLabel?: string;
  copiedLabel?: string;
};

export function CopyToClipboardButton({
  value,
  idleLabel = "Copiar enlace",
  copiedLabel = "Enlace copiado",
}: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleCopy}>
      {copied ? copiedLabel : idleLabel}
    </Button>
  );
}
