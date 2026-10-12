"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { signInAction, signUpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { initialAuthActionState, type AuthActionState } from "@/lib/auth/action-state";

export type LoginFormLabels = {
  signInTitle: string;
  signUpTitle: string;
  description: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  fullName: string;
  fullNamePlaceholder: string;
  signInSubmit: string;
  signUpSubmit: string;
  signingIn: string;
  creatingAccount: string;
  noAccount: string;
  hasAccount: string;
  toggleToSignUp: string;
  toggleToSignIn: string;
  callbackError: string;
};

export type LoginFormProps = {
  lang: Locale;
  /** Sanitised, locale-prefixed path to continue to after a successful sign-in. */
  next: string;
  labels: LoginFormLabels;
  /** Set when `/auth/callback` could not complete an email/OAuth exchange. */
  callbackError?: boolean;
};

type FieldErrors = AuthActionState["fieldErrors"];

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {messages[0]}
    </p>
  );
}

export function LoginForm({ lang, next, labels, callbackError = false }: LoginFormProps) {
  const [mode, setMode] = React.useState<"signIn" | "signUp">("signIn");

  const [signInState, signInFormAction, isSigningIn] = useActionState(
    signInAction,
    initialAuthActionState,
  );
  const [signUpState, signUpFormAction, isSigningUp] = useActionState(
    signUpAction,
    initialAuthActionState,
  );

  const isSignIn = mode === "signIn";
  const isPending = isSigningIn || isSigningUp;
  const state = isSignIn ? signInState : signUpState;
  const fieldErrors: FieldErrors = state.fieldErrors;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {isSignIn ? labels.signInTitle : labels.signUpTitle}
        </CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form
          // `key` resets the form state when switching between sign in / sign up.
          key={mode}
          action={isSignIn ? signInFormAction : signUpFormAction}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Server Actions have no access to the URL, so the locale travels with the form. */}
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="next" value={next} />

          {!isSignIn && (
            <div className="grid gap-2">
              <Label htmlFor="fullName">{labels.fullName}</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder={labels.fullNamePlaceholder}
                required
                aria-invalid={Boolean(fieldErrors?.fullName)}
                aria-describedby={fieldErrors?.fullName ? "fullName-error" : undefined}
              />
              <FieldError id="fullName-error" messages={fieldErrors?.fullName} />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">{labels.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={labels.emailPlaceholder}
              required
              aria-invalid={Boolean(fieldErrors?.email)}
              aria-describedby={fieldErrors?.email ? "email-error" : undefined}
            />
            <FieldError id="email-error" messages={fieldErrors?.email} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">{labels.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              placeholder={labels.passwordPlaceholder}
              required
              minLength={8}
              aria-invalid={Boolean(fieldErrors?.password)}
              aria-describedby={fieldErrors?.password ? "password-error" : undefined}
            />
            <FieldError id="password-error" messages={fieldErrors?.password} />
          </div>

          {/* `role="status"` announces success/failure to screen readers. */}
          <div role="status" aria-live="polite" className="min-h-0">
            {callbackError && <p className="text-destructive text-sm">{labels.callbackError}</p>}
            {state.status === "error" && state.message && (
              <p className="text-destructive text-sm">{state.message}</p>
            )}
            {state.status === "success" && state.message && (
              <p className="text-success text-sm">{state.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isSignIn
              ? isSigningIn
                ? labels.signingIn
                : labels.signInSubmit
              : isSigningUp
                ? labels.creatingAccount
                : labels.signUpSubmit}
          </Button>
        </form>

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {isSignIn ? labels.noAccount : labels.hasAccount}{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setMode(isSignIn ? "signUp" : "signIn")}
          >
            {isSignIn ? labels.toggleToSignUp : labels.toggleToSignIn}
          </Button>
        </p>
      </CardContent>
    </Card>
  );
}
