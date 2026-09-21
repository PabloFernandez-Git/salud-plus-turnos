const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") {
  throw new Error("Seed bloqueado: APP_ENV=production.");
}

throw new Error(
  "Seed DEV no implementado: requiere una tarea posterior con schema, dataset y credenciales aprobados.",
);
