import { describe, expect, it } from "vitest";
import { AppLoader } from "@/components/app-loader";
import CenterLoading from "./loading";
import PatientsLoading from "./patients/loading";
import UsersLoading from "./users/loading";
import SpecialtiesLoading from "./specialties/loading";
import ProfessionalsLoading from "./professionals/loading";

describe("center navigation loading boundaries", () => {
  it.each([
    ["Center", CenterLoading],
    ["Patients", PatientsLoading],
    ["Users", UsersLoading],
    ["Specialties", SpecialtiesLoading],
    ["Professionals", ProfessionalsLoading],
  ])("uses the shared AppLoader in %s", (_, Loading) => {
    const fallback = Loading();
    expect(fallback.type).toBe(AppLoader);
    expect(fallback.props).toEqual({});
  });
});
