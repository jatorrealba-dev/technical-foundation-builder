"use server";

import { revalidatePath } from "next/cache";

import { isArtifactType } from "@/domain/artifacts/artifact-catalog";
import type {
  ArtifactFormat,
  ArtifactType,
  GeneratedArtifact,
} from "@/domain/artifacts/artifact";
import { createClient } from "@/lib/supabase/server";

type RestoreArtifactVersionInput = {
  projectId: string;
  artifactType: string;
  versionId: string;
};

export type RestoreArtifactVersionResult =
  | {
      ok: true;
      artifact: GeneratedArtifact;
      restoredFromVersion: number;
    }
  | {
      ok: false;
      error: string;
    };

type ArtifactRow = {
  id: string;
  project_id: string;
  type: ArtifactType;
  title: string;
  filename: string;
  format: ArtifactFormat;
  content: string;
  created_at: string;
  updated_at: string;
};

type ArtifactVersionRow = {
  id: string;
  artifact_id: string;
  version_number: number;
  title: string;
  filename: string;
  format: ArtifactFormat;
  content: string;
  created_at: string;
};

type LatestVersionRow = {
  id: string;
  version_number: number;
};

function mapArtifact(
  row: ArtifactRow
): GeneratedArtifact {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    filename: row.filename,
    format: row.format,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function revalidateArtifactPaths(
  projectId: string,
  artifactType: ArtifactType
): void {
  revalidatePath(`/projects/${projectId}`);

  revalidatePath(
    `/projects/${projectId}/documents`
  );

  revalidatePath(
    `/projects/${projectId}/documents/${artifactType}`
  );
}

export async function restoreArtifactVersionAction(
  input: RestoreArtifactVersionInput
): Promise<RestoreArtifactVersionResult> {
  const projectId = input.projectId.trim();

  const artifactTypeValue =
    input.artifactType.trim();

  const versionId = input.versionId.trim();

  if (!projectId) {
    return {
      ok: false,
      error:
        "El identificador del proyecto es obligatorio.",
    };
  }

  if (!isArtifactType(artifactTypeValue)) {
    return {
      ok: false,
      error:
        "El tipo de documento seleccionado no es válido.",
    };
  }

  if (!versionId) {
    return {
      ok: false,
      error:
        "La versión seleccionada es obligatoria.",
    };
  }

  const artifactType = artifactTypeValue;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error:
        "Debes iniciar sesión para restaurar una versión.",
    };
  }

  const {
    data: projectData,
    error: projectError,
  } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return {
      ok: false,
      error: projectError.message,
    };
  }

  if (!projectData) {
    return {
      ok: false,
      error:
        "El proyecto no existe o no tienes acceso.",
    };
  }

  const {
    data: artifactData,
    error: artifactError,
  } = await supabase
    .from("artifacts")
    .select(
      "id, project_id, type, title, filename, format, content, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("type", artifactType)
    .maybeSingle();

  if (artifactError) {
    return {
      ok: false,
      error: artifactError.message,
    };
  }

  if (!artifactData) {
    return {
      ok: false,
      error:
        "El documento no existe o no tienes acceso.",
    };
  }

  const artifact =
    artifactData as unknown as ArtifactRow;

  const {
    data: selectedVersionData,
    error: selectedVersionError,
  } = await supabase
    .from("artifact_versions")
    .select(
      "id, artifact_id, version_number, title, filename, format, content, created_at"
    )
    .eq("id", versionId)
    .eq("artifact_id", artifact.id)
    .maybeSingle();

  if (selectedVersionError) {
    return {
      ok: false,
      error: selectedVersionError.message,
    };
  }

  if (!selectedVersionData) {
    return {
      ok: false,
      error:
        "La versión no existe o no pertenece a este documento.",
    };
  }

  const selectedVersion =
    selectedVersionData as unknown as ArtifactVersionRow;

  const {
    data: latestVersionData,
    error: latestVersionError,
  } = await supabase
    .from("artifact_versions")
    .select("id, version_number")
    .eq("artifact_id", artifact.id)
    .order("version_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) {
    return {
      ok: false,
      error: latestVersionError.message,
    };
  }

  const latestVersion = latestVersionData
    ? (latestVersionData as unknown as LatestVersionRow)
    : null;

  if (
    latestVersion &&
    latestVersion.id === selectedVersion.id
  ) {
    return {
      ok: false,
      error:
        "La versión seleccionada ya es la versión vigente.",
    };
  }

  const now = new Date().toISOString();

  const {
    data: restoredArtifactData,
    error: restoreError,
  } = await supabase
    .from("artifacts")
    .update({
      title: selectedVersion.title,
      filename: selectedVersion.filename,
      format: selectedVersion.format,
      content: selectedVersion.content,
      updated_at: now,
    })
    .eq("id", artifact.id)
    .eq("project_id", projectId)
    .select(
      "id, project_id, type, title, filename, format, content, created_at, updated_at"
    )
    .single();

  if (restoreError) {
    return {
      ok: false,
      error: restoreError.message,
    };
  }

  const restoredArtifact = mapArtifact(
    restoredArtifactData as unknown as ArtifactRow
  );

  revalidateArtifactPaths(
    projectId,
    artifactType
  );

  return {
    ok: true,
    artifact: restoredArtifact,
    restoredFromVersion:
      selectedVersion.version_number,
  };
}
