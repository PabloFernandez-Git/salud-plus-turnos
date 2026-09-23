import type { ReactNode } from "react";

export function AuthCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold text-sky-700">Salud Plus</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
