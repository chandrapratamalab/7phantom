import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/features/login-form";
import { getDictionary } from "@/dictionaries";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/auth/dal";
import { routes, safeRedirectPath } from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return { title: dict.auth.signInSubmit, robots: { index: false } };
}

/**
 * Server Component shell for the login form.
 *
 * All the logic lives in Server Actions (`src/actions/auth.ts`); this page only
 * resolves the locale, sanitises `?next=` and hands translated labels down to
 * the client form.
 */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const dict = await getDictionary(lang);

  const fallback = localizedPath(lang, routes.dashboard);
  const next = safeRedirectPath(typeof query.next === "string" ? query.next : undefined, fallback);

  // Already signed in? Skip the form.
  const user = await getCurrentUser();
  if (user) {
    redirect(next);
  }

  return (
    <div className="mx-auto w-full max-w-sm py-10">
      <LoginForm
        lang={lang}
        next={next}
        callbackError={query.error === "callback"}
        labels={{
          signInTitle: dict.auth.signInTitle,
          signUpTitle: dict.auth.signUpTitle,
          description: dict.auth.description,
          email: dict.auth.email,
          emailPlaceholder: dict.auth.emailPlaceholder,
          password: dict.auth.password,
          passwordPlaceholder: dict.auth.passwordPlaceholder,
          fullName: dict.auth.fullName,
          fullNamePlaceholder: dict.auth.fullNamePlaceholder,
          signInSubmit: dict.auth.signInSubmit,
          signUpSubmit: dict.auth.signUpSubmit,
          signingIn: dict.auth.signingIn,
          creatingAccount: dict.auth.creatingAccount,
          noAccount: dict.auth.noAccount,
          hasAccount: dict.auth.hasAccount,
          toggleToSignUp: dict.auth.toggleToSignUp,
          toggleToSignIn: dict.auth.toggleToSignIn,
          callbackError: dict.auth.callbackError,
        }}
      />
    </div>
  );
}
