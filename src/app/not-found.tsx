import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100/80 px-5 py-10 sm:px-8">
      <section className="grid w-full max-w-[780px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-h-[220px] flex-col items-center justify-center bg-sky-50 px-7 py-8 text-center md:min-h-[370px] md:px-9 md:py-12">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-100 bg-white text-sky-700 shadow-sm"
          >
            <svg
              fill="none"
              height="34"
              viewBox="0 0 32 32"
              width="34"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M8 3.5h11l5 5V28H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
              <path d="M19 3.5v5h5M11 15h10M11 20h7" />
              <circle cx="23" cy="23" r="4.5" fill="white" />
              <path d="m26.5 26.5 2.5 2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Error</p>
          <p className="mt-1 text-[5.5rem] leading-none font-bold tracking-[-0.07em] text-sky-900 md:text-[6.5rem]">
            404
          </p>
          <span aria-hidden="true" className="mt-5 h-1 w-12 rounded-full bg-sky-300" />
        </div>
        <div className="flex flex-col items-center justify-center px-7 py-9 text-center sm:px-10 md:items-start md:px-11 md:py-12 md:text-left">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            No encontramos esta página
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Es posible que la dirección sea incorrecta o que la página ya no esté disponible.
          </p>
          <Link
            className="mt-8 inline-flex min-h-11 self-center items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
