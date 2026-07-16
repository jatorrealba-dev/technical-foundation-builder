"use client";

import { Button } from "@/components/ui/button";

type DownloadProjectModelVersionButtonProps = {
  filename: string;
  value: unknown;
  label: string;
};

export function DownloadProjectModelVersionButton({
  filename,
  value,
  label,
}: DownloadProjectModelVersionButtonProps) {
  function handleDownload(): void {
    const content = `${JSON.stringify(
      value,
      null,
      2
    )}\n`;

    const blob = new Blob([content], {
      type: "application/json;charset=utf-8",
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
    >
      {label}
    </Button>
  );
}
