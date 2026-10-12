"use server";

/**
 * Authentication Server Actions.
 * -----------------------------------------------------------------------------
 * Every action follows the same contract, in this order:
 *
 *   1. Resolve the caller's locale (for translated errors).
 *   2. VALIDATE input with Zod — never trust `FormData`.
 *   3. Perform the mutation, re-checking authorization where relevant.
 *   4. `revalidatePath` then `redirect`.
 *
 * Treat each action exactly like a public API endpoint.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDictionary } from "@/dictionaries";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/locale";
import type { AuthActionState } from "@/lib/auth/action-state";
import { env } from "@/lib/env/client";
import { routes, safeRedirectPath } from "@/lib/routes";
import { createCredentialsSchema, createSignUpSchema } from "@/lib/validations/auth";
import { createClient } from "@/utils/supabase/server";

export type { AuthActionState } from "@/lib/auth/action-state";

/** The hidden `lang` field is the only way an action learns the current locale. */
function readLocale(formData: FormData): Locale {
  const value = formData.get("lang");
  return isLocale(value) ? value : defaultLocale;
}

function readValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Normalise an email so `User@Example.com` and `user@example.com` are the same account. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = readLocale(formData);
  const dictionary = await getDictionary(locale);

  // 2. Validate.
  const parsed = createCredentialsSchema({
    email: dictionary.validation.email,
    passwordMin: dictionary.validation.passwordMin,
    fullNameMin: dictionary.validation.fullNameMin,
  }).safeParse({
    email: normalizeEmail(readValue(formData, "email")),
    password: readValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: dictionary.auth.errors.invalidInput,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  // 3. Mutate.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Keep the real cause in the server logs; the client message stays vague.
    console.error("[auth] signInWithPassword failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    // Safe to reveal: this is only returned once the password was correct.
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: dictionary.auth.errors.emailNotConfirmed };
    }

    // Deliberately vague: never reveal whether the email exists.
    return { status: "error", message: dictionary.auth.errors.invalidCredentials };
  }

  // 4. Refresh caches and navigate.
  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("next"), localizedPath(locale, routes.dashboard)));
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = readLocale(formData);
  const dictionary = await getDictionary(locale);

  const parsed = createSignUpSchema({
    email: dictionary.validation.email,
    passwordMin: dictionary.validation.passwordMin,
    fullNameMin: dictionary.validation.fullNameMin,
  }).safeParse({
    fullName: readValue(formData, "fullName"),
    email: normalizeEmail(readValue(formData, "email")),
    password: readValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: dictionary.auth.errors.invalidInput,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Consumed by the `handle_new_user` trigger in the initial migration.
      data: { full_name: parsed.data.fullName, locale },
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(
        localizedPath(locale, routes.dashboard),
      )}`,
    },
  });

  if (error) {
    // Keep the real cause in the server logs; the client message stays generic.
    console.error("[auth] signUp failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return { status: "error", message: dictionary.auth.errors.unknown };
  }

  // Email confirmation is enabled: no session yet, ask the user to check their inbox.
  if (!data.session) {
    return { status: "success", message: dictionary.auth.checkEmail };
  }

  revalidatePath("/", "layout");
  redirect(localizedPath(locale, routes.dashboard));
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect(localizedPath(locale, routes.home));
}
