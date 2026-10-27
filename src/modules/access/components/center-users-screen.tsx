import { ModuleHeader } from "@/components/module-header";

import type {
  AvailableProfessionalCenter,
  CenterUserListItem,
  ManageableProfessionalCenter,
} from "../server/center-users";
import { AddCenterUserPanel } from "./add-center-user-panel";
import { CenterUsersTable } from "./center-users-table";

export function CenterUsersScreen({
  actorUserId,
  centerId,
  loadFailed,
  manageableProfessionalCenters,
  professionalCenters,
  users,
}: {
  actorUserId: string;
  centerId: string;
  centerName: string;
  loadFailed: boolean;
  manageableProfessionalCenters: ManageableProfessionalCenter[];
  professionalCenters: AvailableProfessionalCenter[];
  users: CenterUserListItem[];
}) {
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Gestión de usuarios"
          description="Administrá los usuarios, roles y accesos del centro."
        />

        {loadFailed ? (
          <section
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            role="alert"
          >
            No pudimos cargar los usuarios del centro. Actualizá la página para volver a intentarlo.
          </section>
        ) : (
          <>
            <AddCenterUserPanel
              actorUserId={actorUserId}
              centerId={centerId}
              professionalCenters={professionalCenters}
            />

            <section className="space-y-3" aria-labelledby="center-users-heading">
              <div>
                <h2 className="text-xl font-semibold text-slate-950" id="center-users-heading">
                  Usuarios del centro
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Consultá los usuarios con acceso activo o inactivo a este centro.
                </p>
              </div>
              <CenterUsersTable
                centerId={centerId}
                professionalCenters={manageableProfessionalCenters}
                users={users}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
