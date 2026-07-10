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

  if (!name) {
    redirect(
      "/projects/new?error=El%20nombre%20del%20proyecto%20es%20obligatorio."
    );
  }

  if (!description) {
    redirect(
      "/projects/new?error=La%20descripcion%20del%20proyecto%20es%20obligatoria."
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

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    redirect(
      `/projects/new?error=${encodeURIComponent(
        membershipError.message
      )}`
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
      `/projects/new?error=${encodeURIComponent(
        projectError.message
      )}`
    );
  }

  redirect("/dashboard");
}
