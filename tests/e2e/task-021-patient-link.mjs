export function patientLink(scope, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return scope.getByRole("link", { name: new RegExp(`\\b${escaped}\\b`) });
}
