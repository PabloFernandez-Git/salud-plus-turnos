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
      <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <h2 className="text-lg font-semibold text-slate-950">Todavía no hay centros creados.</h2>
        <p className="mt-2 text-sm text-slate-600">
          Creá el primero junto con su ADMIN inicial para empezar.
        </p>
        <a
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
          href="#crear-centro"
        >
          Crear centro
        </a>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Centros</h2>
        <p className="mt-1 text-sm text-slate-600">
          Los contadores provienen de agregados de plataforma y no exponen datos operativos.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {[
                "Centro",
                "Estado",
                "Dirección",
                "Teléfono",
                "Email",
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
                <td className="px-4 py-4">{display(center.email)}</td>
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
