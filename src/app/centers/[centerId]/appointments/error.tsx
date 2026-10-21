"use client";

export default function AppointmentsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-white p-6"
      >
        <h1 className="text-2xl font-bold text-slate-950">No pudimos cargar turnos</h1>
        <p className="mt-2 text-slate-700">
          Recargá y verificá el estado antes de intentar de nuevo.
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded bg-sky-700 px-4 font-semibold text-white"
          onClick={reset}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
