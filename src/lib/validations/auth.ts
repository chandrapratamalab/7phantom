/**
 * Zod schemas for auth input.
 * -----------------------------------------------------------------------------
 * Schemas are *factories* that accept translated messages. This keeps validation
 * logic in one place while letting the Server Action render errors in the
 * visitor's language (`messages` come from the JSON dictionary).
 */

import { z } from "zod";

export type ValidationMessages = {
  email: string;
  passwordMin: string;
  fullNameMin: string;
};

export function createCredentialsSchema(messages: ValidationMessages) {
  return z.object({
    email: z.email({ message: messages.email }),
    password: z.string().min(8, { message: messages.passwordMin }),
  });
}

export function createSignUpSchema(messages: ValidationMessages) {
  return createCredentialsSchema(messages).extend({
    fullName: z.string().trim().min(2, { message: messages.fullNameMin }),
  });
}

export type CredentialsInput = z.infer<ReturnType<typeof createCredentialsSchema>>;
export type SignUpInput = z.infer<ReturnType<typeof createSignUpSchema>>;
