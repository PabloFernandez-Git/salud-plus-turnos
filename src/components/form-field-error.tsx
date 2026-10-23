export function formFieldErrorProps(message: string | null | undefined, id: string) {
  return {
    "aria-invalid": Boolean(message),
    "aria-describedby": message ? id : undefined,
  };
}

export function FormFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <span id={id} className="text-sm text-red-700">
      {message}
    </span>
  );
}
