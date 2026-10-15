import Link from "next/link";
import { patientSearchUrl, type PatientFilters } from "../search/patient-search-params";
import type { PatientPage } from "../server/patients";
import type { PatientDetail } from "../server/patient-management";
import { PatientWorkspace } from "./patient-workspace";

export function formatPatientBirthDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function PatientsScreen({
  centerId,
  centerName,
  filters,
  result,
  loadFailed = false,
  detail = null,
  detailFailed = false,
}: {
  centerId: string;
  centerName: string;
  filters: PatientFilters;
  result: PatientPage | null;
  loadFailed?: boolean;
  detail?: PatientDetail | null;
  detailFailed?: boolean;
}) {
  const baseUrl = patientSearchUrl(centerId, { query: "", state: "ACTIVE", page: 1 });
  const currentUrl = patientSearchUrl(centerId, filters);
  const rows = result?.rows ?? [];
  const emptyMessage = filters.query
    ? "No encontramos pacientes para esta búsqueda"
    : filters.state === "INACTIVE"
      ? "No hay pacientes inactivos"
      : filters.state === "ALL"
        ? "No hay pacientes registrados"
        : "No hay pacientes activos";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <Link
            className="text-sm font-semibold text-sky-700 hover:underline"
            href={`/centers/${centerId}`}
          >
            Volver al centro
          </Link>
          <p className="text-sm text-slate-600">{centerName}</p>
          <h1 className="text-3xl font-bold text-slate-950">Pacientes</h1>
          <PatientWorkspace
            centerId={centerId}
            filters={filters}
            detail={detail}
            detailFailed={detailFailed}
          />
        </header>
        <form
          action={baseUrl}
          aria-label="Búsqueda de pacientes"
          className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-[minmax(0,1fr)_12rem_auto_auto] sm:items-end"
          method="get"
        >
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-800" htmlFor="patient-query">
              Buscar
            </label>
            <input
              className="min-h-11 w-full rounded-md border border-slate-300 px-3"
              defaultValue={filters.query}
              id="patient-query"
              name="q"
              type="search"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-800" htmlFor="patient-state">
              Estado
            </label>
            <select
              className="min-h-11 w-full rounded-md border border-slate-300 px-3"
              defaultValue={filters.state}
              id="patient-state"
              name="state"
            >
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
              <option value="ALL">Todos</option>
            </select>
          </div>
          <button
            className="min-h-11 rounded-md bg-sky-700 px-5 font-semibold text-white hover:bg-sky-800"
            type="submit"
          >
            Buscar
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-sky-700 hover:underline"
            href={baseUrl}
          >
            Limpiar
          </Link>
          <p className="text-sm text-slate-600 sm:col-span-4">
            Buscá por documento, nombre, teléfono o email dentro de este centro.
          </p>
        </form>
        {loadFailed ? (
          <div
            aria-live="polite"
            className="rounded-xl border border-rose-200 bg-white p-6"
            role="alert"
          >
            <p>No pudimos cargar los pacientes. Intentá de nuevo.</p>
            <Link
              className="mt-3 inline-block font-semibold text-sky-700 underline"
              href={currentUrl}
            >
              Reintentar
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
            {emptyMessage}
          </p>
        ) : (
          <section aria-label="Listado de pacientes" className="space-y-4">
            <p className="text-sm text-slate-600">Página {filters.page}</p>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-3" scope="col">
                      Nombre y apellido
                    </th>
                    <th className="p-3" scope="col">
                      Documento
                    </th>
                    <th className="p-3" scope="col">
                      Nacimiento
                    </th>
                    <th className="p-3" scope="col">
                      Teléfono
                    </th>
                    <th className="p-3" scope="col">
                      Email
                    </th>
                    <th className="p-3" scope="col">
                      Obra social / prepaga
                    </th>
                    <th className="p-3" scope="col">
                      Estado
                    </th>
                    <th className="p-3" scope="col">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="border-t border-slate-200" key={row.patient_center_id}>
                      <th className="p-3 font-medium text-slate-900" scope="row">
                        {row.first_name} {row.last_name}
                      </th>
                      <td className="p-3">
                        {row.nationality_code} · {row.document_number}
                      </td>
                      <td className="p-3">{formatPatientBirthDate(row.birth_date)}</td>
                      <td className="p-3">{row.phone}</td>
                      <td className="p-3">{row.email ?? "—"}</td>
                      <td className="p-3">{row.insurance_name ?? "—"}</td>
                      <td className="p-3">
                        <Status active={row.is_active} />
                      </td>
                      <td className="p-3">
                        <Link
                          className="font-semibold text-sky-700 underline"
                          href={patientSearchUrl(centerId, filters, row.patient_center_id)}
                        >
                          Administrar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <article
                  className="rounded-xl border border-slate-200 bg-white p-4"
                  key={row.patient_center_id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-slate-900">
                      {row.first_name} {row.last_name}
                    </h2>
                    <Status active={row.is_active} />
                  </div>
                  <p className="mt-2 text-sm font-medium">{row.phone}</p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-slate-700">
                    <dt>Documento</dt>
                    <dd>
                      {row.nationality_code} · {row.document_number}
                    </dd>
                    <dt>Nacimiento</dt>
                    <dd>{formatPatientBirthDate(row.birth_date)}</dd>
                    <dt>Email</dt>
                    <dd>{row.email ?? "—"}</dd>
                    <dt>Obra social / prepaga</dt>
                    <dd>{row.insurance_name ?? "—"}</dd>
                  </dl>
                  <Link
                    className="mt-3 inline-block font-semibold text-sky-700 underline"
                    href={patientSearchUrl(centerId, filters, row.patient_center_id)}
                  >
                    Administrar
                  </Link>
                </article>
              ))}
            </div>
            <nav aria-label="Paginación de pacientes" className="flex items-center gap-4">
              {result?.hasPrevious && (
                <Link
                  className="font-semibold text-sky-700 underline"
                  href={patientSearchUrl(centerId, { ...filters, page: filters.page - 1 })}
                >
                  Anterior
                </Link>
              )}
              {result?.hasNext && (
                <Link
                  className="font-semibold text-sky-700 underline"
                  href={patientSearchUrl(centerId, { ...filters, page: filters.page + 1 })}
                >
                  Siguiente
                </Link>
              )}
            </nav>
            {result?.atOffsetCeiling && (
              <p className="text-sm text-slate-600">
                Se alcanzó el límite de páginas. Refiná la búsqueda para ver más pacientes.
              </p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
