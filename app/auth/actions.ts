"use server";

import { redirect } from "next/navigation";

import { isSafeInternalPath } from "@/domain/organizations/collaboration";
import { createClient } from "@/lib/supabase/server";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function authPath(input: {
  pathname: "/login" | "/register";
  error?: string;
  message?: string;
  nextPath?: string;
}): string {
  const query = new URLSearchParams();

  if (input.error) {
    query.set("error", input.error);
  }

  if (input.message) {
    query.set("message", input.message);
  }

  if (isSafeInternalPath(input.nextPath)) {
    query.set("next", input.nextPath);
  }

  const suffix = query.toString();
  return suffix ? `${input.pathname}?${suffix}` : input.pathname;
}

export async function signInAction(formData: FormData) {
  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");
  const nextPath = getFormValue(formData, "next");

  if (!email || !password) {
    redirect(
      authPath({
        pathname: "/login",
        error: "Email y password son obligatorios.",
        nextPath,
      })
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      authPath({
        pathname: "/login",
        error: error.message,
        nextPath,
      })
    );
  }

  redirect(isSafeInternalPath(nextPath) ? nextPath : "/dashboard");
}

export async function signUpAction(formData: FormData) {
  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");
  const nextPath = getFormValue(formData, "next");

  if (!email || !password) {
    redirect(
      authPath({
        pathname: "/register",
        error: "Email y password son obligatorios.",
        nextPath,
      })
    );
  }

  if (password.length < 8) {
    redirect(
      authPath({
        pathname: "/register",
        error: "El password debe tener al menos 8 caracteres.",
        nextPath,
      })
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(
      authPath({
        pathname: "/register",
        error: error.message,
        nextPath,
      })
    );
  }

  redirect(
    authPath({
      pathname: "/login",
      message:
        "Cuenta creada. Si Supabase requiere confirmación, revisa tu correo antes de iniciar sesión.",
      nextPath,
    })
  );
}
