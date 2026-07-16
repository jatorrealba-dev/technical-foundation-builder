"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const allowedProductTypes = [
  "web_app",
  "mobile_app",
  "saas",
  "internal_system",
  "marketplace",
  "ecommerce",
  "ai_tool",
  "other",
];

const allowedTechnicalLevels = [
  "non_technical",
  "beginner",
  "intermediate",
  "advanced",
];

function getFormValue(
  formData: FormData,
  key: string
): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getSafeOption(
  value: string,
  allowedValues: string[],
  fallback: string
): string {
  if (allowedValues.includes(value)) {
    return value;
  }

  return fallback;
}

function newProjectPath(input: {
  organizationId?: string;
  error?: string;
}): string {
  const query = new URLSearchParams();

  if (input.organizationId) {
    query.set("organizationId", input.organizationId);
  }

  if (input.error) {
    query.set("error", input.error);
  }

  const suffix = query.toString();
  return suffix ? `/projects/new?${suffix}` : "/projects/new";
}

export async function createProjectAction(
  formData: FormData
) {
  const name = getFormValue(formData, "name");
  const description = getFormValue(
    formData,
    "description"
  );
  const industry = getFormValue(
    formData,
    "industry"
  );

  const productType = getSafeOption(
    getFormValue(formData, "productType"),
    allowedProductTypes,
    "saas"
  );

  const technicalLevel = getSafeOption(
    getFormValue(formData, "technicalLevel"),
    allowedTechnicalLevels,
    "non_technical"
  );

  const mainGoal = getFormValue(
    formData,
    "mainGoal"
  );

  const requestedOrganizationId = getFormValue(
    formData,
    "organizationId"
  );

  if (!name) {
    redirect(
      newProjectPath({
        organizationId: requestedOrganizationId,
        error: "El nombre del proyecto es obligatorio.",
      })
    );
  }

  if (!description) {
    redirect(
      newProjectPath({
        organizationId: requestedOrganizationId,
        error: "La descripción del proyecto es obligatoria.",
      })
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      "/login?error=Debes%20iniciar%20sesion."
    );
  }

  let membershipQuery = supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

  if (requestedOrganizationId) {
    membershipQuery = membershipQuery.eq(
      "organization_id",
      requestedOrganizationId
    );
  }

  const {
    data: membership,
    error: membershipError,
  } = await membershipQuery.limit(1).maybeSingle();

  if (membershipError) {
    redirect(
      newProjectPath({
        organizationId: requestedOrganizationId,
        error: membershipError.message,
      })
    );
  }

  if (!membership) {
    redirect("/onboarding");
  }

  const { error: projectError } = await supabase
    .from("projects")
    .insert({
      organization_id:
        membership.organization_id,
      owner_id: user.id,
      name,
      description,
      industry,
      product_type: productType,
      technical_level: technicalLevel,
      main_goal: mainGoal,
      status: "draft",
    });

  if (projectError) {
    redirect(
      newProjectPath({
        organizationId: membership.organization_id,
        error: projectError.message,
      })
    );
  }

  redirect(`/dashboard?organizationId=${membership.organization_id}`);
}
