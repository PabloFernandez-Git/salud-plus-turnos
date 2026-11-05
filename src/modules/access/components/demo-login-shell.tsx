import type { ReactNode } from "react";

export function DemoLoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-100 px-4 py-8 sm:px-6 md:items-center md:py-12">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30 md:min-h-[700px] md:grid-cols-[47%_53%]">
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-sky-950 via-blue-700 to-cyan-600 p-10 md:flex md:flex-col lg:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-16 -top-16 size-56 rounded-full bg-teal-200/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-20 h-48 w-[135%] -rotate-8 rounded-[50%] bg-emerald-300/20" />
            <div className="absolute -bottom-28 -right-16 h-48 w-[135%] rotate-8 rounded-[50%] bg-teal-300/20" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15">
              <div className="absolute left-1/2 top-1/2 h-72 w-24 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white" />
              <div className="h-24 w-72 rounded-3xl bg-white" />
            </div>
          </div>
          <div className="relative space-y-3">
            <p className="text-2xl font-semibold tracking-tight text-white">Salud Plus</p>
            <div className="h-1 w-12 rounded-full bg-emerald-300" />
          </div>
        </div>
        <div className="relative z-10 flex min-w-0 flex-col justify-start bg-slate-50 px-6 py-8 sm:px-10 sm:py-10 md:-ml-6 md:rounded-l-[5rem] md:px-8 lg:px-10 lg:py-12">
          <p className="mb-8 text-xl font-semibold tracking-tight text-sky-800 md:hidden">
            Salud Plus
          </p>
          {children}
        </div>
      </section>
    </main>
  );
}
