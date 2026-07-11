"use client";

import { useState } from "react";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";

type PackageArtifact = {
  filename: string;
  content: string;
};

type DownloadPackageButtonProps = {
  projectName: string;
  artifacts: readonly PackageArtifact[];
  label?: string;
};

function createSafeFilename(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "technical-foundation";
}

function downloadBlob(input: {
  blob: Blob;
  filename: string;
}): void {
  const downloadUrl = URL.createObjectURL(input.blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = input.filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
}

export function DownloadPackageButton({
  projectName,
  artifacts,
  label = "Descargar paquete ZIP",
}: DownloadPackageButtonProps) {
  const [isGenerating, setIsGenerating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const downloadableArtifacts = artifacts.filter(
    (artifact) =>
      artifact.filename.trim() &&
      artifact.content.trim()
  );

  async function handleDownload() {
    if (
      isGenerating ||
      downloadableArtifacts.length === 0
    ) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const zip = new JSZip();

      for (const artifact of downloadableArtifacts) {
        zip.file(
          artifact.filename,
          artifact.content
        );
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6,
        },
      });

      downloadBlob({
        blob,
        filename: `${createSafeFilename(
          projectName
        )}-technical-foundation.zip`,
      });
    } catch (downloadError) {
      console.error(
        "No se pudo generar el paquete ZIP.",
        downloadError
      );

      setError(
        "No se pudo generar el paquete ZIP. Intenta nuevamente."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleDownload}
        disabled={
          isGenerating ||
          downloadableArtifacts.length === 0
        }
      >
        {isGenerating
          ? "Preparando ZIP..."
          : label}
      </Button>

      {error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
