import type { ReactNode } from "react";

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="v1-login-shell flex min-h-screen items-start justify-center bg-slate-100 px-4 py-8 sm:px-6 md:items-center md:py-12">
      <section className="v1-login-frame relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-[#1165c3] shadow-xl shadow-slate-300/30 md:min-h-[700px] md:grid-cols-[47%_53%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-20 bg-slate-50 md:block"
        />
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#00aead] via-[#0755c3] to-[#08a8ad] p-10 md:flex md:w-[calc(100%-1.5rem)] md:flex-col md:justify-center md:rounded-br-[5rem] lg:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-20 size-72 rounded-full bg-teal-300/25 blur-3xl" />
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="absolute -bottom-36 -left-[55%] h-80 w-[145%] rotate-[25deg] rounded-[50%] bg-gradient-to-r from-emerald-400/60 to-cyan-300/25" />
            <div className="absolute -bottom-44 -left-[65%] h-72 w-[145%] rotate-[20deg] rounded-[50%] bg-emerald-400/65" />
            <div className="absolute left-[85%] top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
              <div className="absolute left-1/2 top-1/2 h-96 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] bg-white" />
              <div className="h-28 w-96 rounded-[2rem] bg-white" />
            </div>
          </div>
          <div className="relative space-y-3">
            <p className="text-4xl font-semibold tracking-tight text-white lg:text-5xl">
              Salud Plus
            </p>
            <div className="h-1.5 w-20 rounded-full bg-emerald-400" />
          </div>
        </div>
        <div className="v1-login-content relative z-10 flex min-w-0 flex-col justify-center bg-slate-50 px-6 py-8 sm:px-10 sm:py-10 md:-ml-6 md:rounded-tl-[5rem] md:px-8 lg:px-10 lg:py-12">
          <p className="mb-8 text-xl font-semibold tracking-tight text-sky-800 md:hidden">
            Salud Plus
          </p>
          <div className="v1-login-card rounded-[2rem] bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200/60 sm:p-8 md:p-6 lg:p-8">
            <div className="mb-5 space-y-2 text-left">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Iniciar sesión</h1>
              <p className="text-sm leading-6 text-slate-600">
                Ingresá con el usuario y contraseña que te asignó tu centro.
              </p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
