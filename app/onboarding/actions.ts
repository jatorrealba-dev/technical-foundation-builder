"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createOrganizationAction(formData: FormData) {
  const organizationName = getFormValue(formData, "organizationName");

  if (!organizationName) {
    redirect("/onboarding?error=El%20nombre%20de%20la%20organizacion%20es%20obligatorio.");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?error=Debes%20iniciar%20sesion.");
  }

  const organizationId = randomUUID();
  const slugBase = slugify(organizationName) || "organization";
  const slug = `${slugBase}-${organizationId.slice(0, 8)}`;

  const { error: organizationError } = await supabase
    .from("organizations")
    .insert({
      id: organizationId,
      name: organizationName,
      slug,
      created_by: user.id,
    });

  if (organizationError) {
    redirect(
      `/onboarding?error=${encodeURIComponent(organizationError.message)}`
    );
  }

  const { error: membershipError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      role: "owner",
    });

  if (membershipError) {
    redirect(
      `/onboarding?error=${encodeURIComponent(membershipError.message)}`
    );
  }

  redirect("/dashboard");
}
