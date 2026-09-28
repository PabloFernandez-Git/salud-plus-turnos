import { z } from "zod";

const emailSchema = z.string().trim().min(1, "Ingresá tu email.").email("Ingresá un email válido.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export const recoverySchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres."),
    passwordConfirmation: z.string().min(1, "Confirmá la nueva contraseña."),
  })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
