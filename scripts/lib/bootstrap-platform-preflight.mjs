export const bootstrapPlatformPreflightKeys = Object.freeze([
  "platform_is_empty",
  "auth_users_empty",
  "public_users_empty",
  "platform_admins_empty",
  "centers_empty",
  "center_memberships_empty",
]);

export function assertBootstrapPlatformPreflightResponse(value) {
  const actualKeys =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Reflect.ownKeys(value)
      : [];
  const hasExactKeys =
    actualKeys.length === bootstrapPlatformPreflightKeys.length &&
    bootstrapPlatformPreflightKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ) &&
    actualKeys.every(
      (key) => typeof key === "string" && bootstrapPlatformPreflightKeys.includes(key),
    );
  const hasOnlyBooleanValues =
    hasExactKeys && bootstrapPlatformPreflightKeys.every((key) => typeof value[key] === "boolean");

  if (!hasExactKeys || !hasOnlyBooleanValues) {
    throw new Error("La RPC de preflight devolvió una respuesta inválida; bootstrap bloqueado.");
  }

  return value;
}
