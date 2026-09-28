import type { CenterUserListItem } from "../server/center-users";
import type { ManageableProfessionalCenter } from "../server/center-users";
import { ManageCenterMembershipPanel } from "./manage-center-membership-panel";

const roleLabels: Record<CenterUserListItem["role"], string> = {
  ADMIN: "Administrador",
  RECEPTION: "Recepción",
  PROFESSIONAL: "Profesional",
};

function ProfessionalAssociation({ user }: { user: CenterUserListItem }) {
  if (!user.professional) return <span aria-label="Sin profesional asociado">—</span>;

  return (
    <div className="space-y-1">
      <p className="font-medium text-slate-900">
        {user.professional.firstName} {user.professional.lastName}
      </p>
      {user.professional.licenseNumber ? (
        <p className="text-xs text-slate-500">Matrícula: {user.professional.licenseNumber}</p>
      ) : null}
      {!user.professional.isActive ? (
        <p className="text-xs font-medium text-amber-700">Vínculo inactivo</p>
      ) : null}
    </div>
  );
}

export function CenterUsersTable({
  centerId,
  professionalCenters,
  users,
}: {
  centerId: string;
  professionalCenters: ManageableProfessionalCenter[];
  users: CenterUserListItem[];
}) {
  if (users.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <h2 className="text-lg font-semibold text-slate-950">No hay usuarios para mostrar.</h2>
        <p className="mt-2 text-sm text-slate-600">
          No se encontraron accesos visibles en este centro.
        </p>
      </section>
    );
  }

  const activeAdminCount = users.filter((user) => user.role === "ADMIN" && user.isActive).length;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {["Nombre", "Email", "Rol", "Estado", "Profesional asociado", "Acciones"].map(
              (heading) => (
                <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3" key={heading}>
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <tr className="align-top text-slate-700" key={user.id}>
              <td className="px-4 py-4 font-semibold text-slate-950">
                {user.firstName} {user.lastName}
              </td>
              <td className="px-4 py-4">{user.email}</td>
              <td className="px-4 py-4">{roleLabels[user.role]}</td>
              <td className="px-4 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    user.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {user.isActive ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="px-4 py-4">
                <ProfessionalAssociation user={user} />
              </td>
              <td className="px-4 py-4">
                <ManageCenterMembershipPanel
                  activeAdminCount={activeAdminCount}
                  centerId={centerId}
                  professionalCenters={professionalCenters}
                  user={user}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
