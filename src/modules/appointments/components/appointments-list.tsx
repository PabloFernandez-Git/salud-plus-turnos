import Link from "next/link";
import { ModuleHeader, modulePrimaryActionClass } from "@/components/module-header";
import type { AvailabilityProfessionalCenter } from "@/modules/availability/server/availability";
import type { listAppointments } from "../server/appointments";
import {
  addCivilDays,
  appointmentLocalParts,
  appointmentSearchUrl,
  readableCivilDate,
  type AppointmentFilters,
} from "../search/appointment-search";

type ListResult = Awaited<ReturnType<typeof listAppointments>>;
const statuses = ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"] as const;
export const appointmentStatusLabels: Record<(typeof statuses)[number], string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  ATTENDED: "Atendido",
  NO_SHOW: "Ausente",
  CANCELLED: "Cancelado",
};
export const appointmentStatusClass: Record<(typeof statuses)[number], string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-900",
  ATTENDED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  NO_SHOW: "border-orange-200 bg-orange-50 text-orange-900",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
};
const linkClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-sky-700 px-4 py-2 font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700";
const quickLinkBaseClass =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-center font-semibold leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:w-auto";

export function AppointmentsList({
  centerId,
  timezone,
  today,
  role,
  filters,
  result,
  loadFailed,
  professionals,
}: {
  centerId: string;
  centerName: string;
  timezone: string;
  today: string;
  role: "ADMIN" | "RECEPTION" | "PROFESSIONAL";
  filters: AppointmentFilters;
  result: ListResult | null;
  loadFailed: boolean;
  professionals: AvailabilityProfessionalCenter[];
}) {
  const base = `/centers/${centerId}/appointments`;
  const recentFrom = addCivilDays(today, -30);
  const unfiltered = !filters.status && !filters.professionalCenterId;
  const upcomingActive =
    unfiltered && filters.fromDate === today && filters.toDate === addCivilDays(today, 30);
  const recentActive = unfiltered && filters.fromDate === recentFrom && filters.toDate === today;
  const quickLinkClass = (active: boolean) =>
    `${quickLinkBaseClass} ${active ? "border-sky-700 bg-sky-700 text-white hover:bg-sky-800" : "border-sky-700 bg-white text-sky-800 hover:bg-sky-50"}`;
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Turnos"
          description="Consultá y gestioná los turnos del centro."
          actions={
            role !== "PROFESSIONAL" && (
              <Link className={`${modulePrimaryActionClass} cursor-pointer`} href={`${base}/new`}>
                Crear turno
              </Link>
            )
          }
        />
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Buscar turnos</h2>
          <form
            action={base}
            method="get"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-sm font-medium text-slate-800">
              Desde
              <input
                className="mt-1 min-h-11 w-full cursor-pointer rounded border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                type="date"
                name="from"
                defaultValue={filters.fromDate}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Hasta (máximo 31 días)
              <input
                className="mt-1 min-h-11 w-full cursor-pointer rounded border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                type="date"
                name="to"
                defaultValue={filters.toDate}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Estado
              <select
                className="mt-1 min-h-11 w-full cursor-pointer rounded border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                name="status"
                defaultValue={filters.status ?? ""}
              >
                <option value="">Todos</option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {appointmentStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            {role !== "PROFESSIONAL" && (
              <label className="text-sm font-medium text-slate-800">
                Profesional
                <select
                  className="mt-1 min-h-11 w-full cursor-pointer rounded border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                  name="professional"
                  defaultValue={filters.professionalCenterId ?? ""}
                >
                  <option value="">Todos</option>
                  {professionals.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="min-h-11 cursor-pointer rounded bg-sky-700 px-4 font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 lg:col-start-4"
              type="submit"
            >
              Aplicar filtros
            </button>
          </form>
          <div className="mt-5 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap">
            <Link
              className={quickLinkClass(upcomingActive)}
              href={base}
              aria-current={upcomingActive ? "true" : undefined}
            >
              Próximos turnos
            </Link>
            <Link
              className={quickLinkClass(recentActive)}
              aria-current={recentActive ? "true" : undefined}
              href={appointmentSearchUrl(centerId, {
                fromDate: recentFrom,
                toDate: today,
              })}
            >
              Últimos 30 días, incluidos cancelados
            </Link>
          </div>
        </section>
        <section
          aria-label="Resultados de turnos"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          {loadFailed ? (
            <div role="alert">
              <p>No pudimos cargar los turnos.</p>
              <Link
                className="cursor-pointer text-sky-700 underline hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                href={appointmentSearchUrl(centerId, filters)}
              >
                Reintentar
              </Link>
            </div>
          ) : result?.rows.length === 0 ? (
            <p>No hay turnos para estos filtros.</p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {result?.rows.map((row) => {
                const start = appointmentLocalParts(row.starts_at, timezone);
                const end = appointmentLocalParts(row.ends_at, timezone);
                return (
                  <li
                    key={row.appointment_id}
                    className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-5"
                  >
                    <div className="flex h-full min-w-0 flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="min-w-0 text-lg font-semibold text-slate-950">
                          {row.patient_first_name} {row.patient_last_name}
                        </p>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${appointmentStatusClass[row.status]}`}
                        >
                          {appointmentStatusLabels[row.status]}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-slate-900">
                        {readableCivilDate(start.date)} · {start.time}–{end.time}
                        {end.date !== start.date ? ` (${readableCivilDate(end.date)})` : ""}
                      </p>
                      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
                        <p className="min-w-0 text-sm text-slate-700">
                          {row.specialty_name}
                          {"professional_first_name" in row
                            ? ` · ${row.professional_first_name} ${row.professional_last_name}`
                            : ""}
                        </p>
                        <Link className={linkClass} href={`${base}/${row.appointment_id}`}>
                          Ver detalle
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {result?.hasMore && result.nextCursor && (
            <Link
              className={`${linkClass} mt-5`}
              href={appointmentSearchUrl(centerId, { ...filters, cursor: result.nextCursor })}
            >
              Siguiente página
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
