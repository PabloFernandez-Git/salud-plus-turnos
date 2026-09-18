import { DEFAULT_TIMEZONE } from "@/lib/time/default-timezone";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide">Project Bootstrap</p>
      <h1 className="text-4xl font-bold tracking-tight">Gestor de turnos</h1>
      <p className="text-lg leading-8">
        Base técnica del gestor de agenda para consultorios y centros médicos.
      </p>
      <div className="rounded-lg border p-4 text-sm">
        Zona horaria inicial del MVP: <strong>{DEFAULT_TIMEZONE}</strong>
      </div>
    </main>
  );
}
