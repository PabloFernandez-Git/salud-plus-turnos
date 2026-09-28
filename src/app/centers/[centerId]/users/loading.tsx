export default function CenterUsersLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-8" aria-busy="true" aria-live="polite">
        <section className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-4 h-9 w-56 rounded bg-slate-200" />
          <div className="mt-3 h-5 w-72 max-w-full rounded bg-slate-200" />
        </section>
        <section className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Cargando usuarios del centro…</p>
          <div className="mt-5 h-52 rounded bg-slate-100" />
        </section>
      </div>
    </main>
  );
}
