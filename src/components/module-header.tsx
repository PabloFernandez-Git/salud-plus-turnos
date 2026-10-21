import Link from "next/link";
import type { ReactNode } from "react";

export const modulePrimaryActionClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60";
export const moduleSecondaryActionClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700";

export function ModuleHeader({
  centerId,
  title,
  description,
  actions,
  parent,
}: {
  centerId: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  parent?: { label: string; href: string };
}) {
  return (
    <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          className="font-medium text-sky-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          href={`/centers/${centerId}`}
        >
          Inicio
        </Link>
        <span aria-hidden="true" className="text-slate-400">
          /
        </span>
        {parent && (
          <>
            <Link
              className="font-medium text-sky-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href={parent.href}
            >
              {parent.label}
            </Link>
            <span aria-hidden="true" className="text-slate-400">
              /
            </span>
          </>
        )}
        <span aria-current="page" className="font-medium text-slate-600">
          {title}
        </span>
      </nav>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
