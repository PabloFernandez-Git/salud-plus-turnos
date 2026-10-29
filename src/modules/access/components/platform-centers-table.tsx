import type { PlatformCenterSummary } from "../server/administration";
import { CenterStatusForm } from "./center-status-form";

const createdAtFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function display(value: string | null) {
  return value?.trim() || "—";
}

export function PlatformCentersTable({ centers }: { centers: PlatformCenterSummary[] }) {
  if (centers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <h3 className="text-lg font-semibold text-slate-950">Todavía no hay centros creados.</h3>
        <p className="mt-2 text-sm text-slate-600">
          Creá el primero junto con su administrador inicial para empezar.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-600">
        Los contadores provienen de agregados de plataforma y no exponen datos operativos.
      </p>
      <ul className="grid gap-3 md:hidden">
        {centers.map((center) => (
          <li
            className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            key={center.center_id}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 break-words text-lg font-semibold text-slate-950">
                {center.name}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${center.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
              >
                {center.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <dl className="mt-4 grid min-w-0 gap-3 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-500">Dirección</dt>
                <dd className="break-words">{display(center.address)}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <dt className="font-medium text-slate-500">Teléfono</dt>
                  <dd className="break-words">{display(center.phone)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-slate-500">Fecha de alta</dt>
                  <dd>{createdAtFormatter.format(new Date(center.created_at))}</dd>
                </div>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Email del centro</dt>
                <dd className="break-all">{display(center.email)}</dd>
              </div>
            </dl>
            <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-sm">
              <div>
                <dt className="text-xs text-slate-600">Usuarios</dt>
                <dd className="font-semibold tabular-nums text-slate-950">
                  {center.active_membership_count}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Profesionales</dt>
                <dd className="font-semibold tabular-nums text-slate-950">
                  {center.active_professional_center_count}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Especialidades</dt>
                <dd className="font-semibold tabular-nums text-slate-950">
                  {center.active_specialty_count}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <CenterStatusForm
                centerId={center.center_id}
                centerName={center.name}
                isActive={center.is_active}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {[
                "Centro",
                "Estado",
                "Dirección",
                "Teléfono",
                "Email del centro",
                "Fecha de alta",
                "Usuarios",
                "Profesionales",
                "Especialidades",
                "Acciones",
              ].map((heading) => (
                <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {centers.map((center) => (
              <tr className="align-top text-slate-700" key={center.center_id}>
                <td className="px-4 py-4 font-semibold text-slate-950">{center.name}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      center.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {center.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="max-w-56 px-4 py-4">{display(center.address)}</td>
                <td className="whitespace-nowrap px-4 py-4">{display(center.phone)}</td>
                <td className="max-w-56 break-all px-4 py-4">{display(center.email)}</td>
                <td className="whitespace-nowrap px-4 py-4">
                  {createdAtFormatter.format(new Date(center.created_at))}
                </td>
                <td className="px-4 py-4 tabular-nums">{center.active_membership_count}</td>
                <td className="px-4 py-4 tabular-nums">
                  {center.active_professional_center_count}
                </td>
                <td className="px-4 py-4 tabular-nums">{center.active_specialty_count}</td>
                <td className="px-4 py-4">
                  <CenterStatusForm
                    centerId={center.center_id}
                    centerName={center.name}
                    isActive={center.is_active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
