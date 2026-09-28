import Link from "next/link";

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
  centerName,
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
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-700">Administración del centro</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Usuarios</h1>
              <p className="text-lg font-medium text-slate-800">{centerName}</p>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Consultá las cuentas, roles y accesos asociados a este centro, y agregá nuevas
                memberships sin modificar identidades existentes.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              href={`/centers/${centerId}`}
            >
              Volver al centro
            </Link>
          </div>
        </header>

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
                  El listado incluye accesos activos e inactivos visibles para este ADMIN.
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
