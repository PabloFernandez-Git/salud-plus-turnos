import type { ReactNode } from "react";

export function DemoLoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 sm:px-6 md:py-12">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30 md:min-h-[620px] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-sky-900 via-blue-700 to-cyan-600 p-10 md:flex md:flex-col lg:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-24 -left-20 size-64 rounded-full bg-emerald-300/20 blur-3xl" />
            <div className="absolute -right-16 -top-16 size-56 rounded-full bg-teal-200/20 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
              <div className="absolute left-1/2 top-1/2 h-72 w-24 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white" />
              <div className="h-24 w-72 rounded-3xl bg-white" />
            </div>
          </div>
          <p className="relative text-2xl font-semibold tracking-tight text-white">Salud Plus</p>
        </div>
        <div className="min-w-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <p className="mb-8 text-xl font-semibold tracking-tight text-sky-800 md:hidden">
            Salud Plus
          </p>
          {children}
        </div>
      </section>
    </main>
  );
}
