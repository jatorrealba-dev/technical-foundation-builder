"use client";

import { Button } from "@/components/ui/button";

type DownloadArtifactButtonProps = {
  filename: string;
  content: string;
  label?: string;
};

export function DownloadArtifactButton({
  filename,
  content,
  label = "Descargar Markdown",
}: DownloadArtifactButtonProps) {
  function handleDownload() {
    const blob = new Blob([content], {
      type: "text/markdown;charset=utf-8",
    });

    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = filename;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 0);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDownload}
      disabled={!content.trim()}
    >
      {label}
    </Button>
  );
}
