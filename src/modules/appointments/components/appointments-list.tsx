import Link from "next/link";
import type { AvailabilityProfessionalCenter } from "@/modules/availability/server/availability";
import type { listAppointments } from "../server/appointments";
import {
  addCivilDays,
  appointmentLocalParts,
  appointmentSearchUrl,
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
const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-sky-700 px-4 py-2 font-semibold text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700";

export function AppointmentsList({
  centerId,
  centerName,
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
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-sky-700">Administración del centro</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Turnos</h1>
              <p className="mt-1 text-slate-700">
                {centerName} · {timezone}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {role === "PROFESSIONAL" ? "Tus turnos" : "Turnos del centro"}. Fechas y horas en la
                zona del centro.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {role !== "PROFESSIONAL" && (
                <Link className={linkClass} href={`${base}/new`}>
                  Crear turno
                </Link>
              )}
              <Link className={linkClass} href={`/centers/${centerId}`}>
                Volver al centro
              </Link>
            </div>
          </div>
        </header>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Buscar turnos</h2>
          <form
            action={base}
            method="get"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-sm font-medium text-slate-800">
              Desde
              <input
                className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"
                type="date"
                name="from"
                defaultValue={filters.fromDate}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Hasta (máximo 31 días)
              <input
                className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"
                type="date"
                name="to"
                defaultValue={filters.toDate}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Estado
              <select
                className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"
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
                  className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"
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
              className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white lg:col-start-4"
              type="submit"
            >
              Aplicar filtros
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link className="font-semibold text-sky-700 underline" href={base}>
              Próximos turnos
            </Link>
            <Link
              className="font-semibold text-sky-700 underline"
              href={appointmentSearchUrl(centerId, {
                fromDate: addCivilDays(today, -30),
                toDate: today,
              })}
            >
              Últimos 30 días, incluidos cancelados
            </Link>
          </div>
        </section>
        <section
          aria-label="Resultados de turnos"
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          {loadFailed ? (
            <div role="alert">
              <p>No pudimos cargar los turnos.</p>
              <Link
                className="text-sky-700 underline"
                href={appointmentSearchUrl(centerId, filters)}
              >
                Reintentar
              </Link>
            </div>
          ) : result?.rows.length === 0 ? (
            <p>No hay turnos para estos filtros.</p>
          ) : (
            <ul className="space-y-3">
              {result?.rows.map((row) => {
                const start = appointmentLocalParts(row.starts_at, timezone);
                const end = appointmentLocalParts(row.ends_at, timezone);
                return (
                  <li key={row.appointment_id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-950">
                          {row.patient_first_name} {row.patient_last_name}
                        </p>
                        <p className="text-sm text-slate-700">
                          {row.specialty_name}
                          {"professional_first_name" in row
                            ? ` · ${row.professional_first_name} ${row.professional_last_name}`
                            : ""}
                        </p>
                        <p className="text-sm text-slate-700">
                          {start.date} · {start.time}–{end.time}
                          {end.date !== start.date ? ` (${end.date})` : ""}
                        </p>
                        <p className="text-sm text-slate-600">
                          {appointmentStatusLabels[row.status]}
                        </p>
                      </div>
                      <Link className={linkClass} href={`${base}/${row.appointment_id}`}>
                        Ver detalle
                      </Link>
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
