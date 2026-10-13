import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  patientRpcContracts,
  type PatientRpcArgs,
  type PatientRpcName,
  type PatientRpcResult,
} from "./patient-rpc-contracts";

type PatientTransport = (
  name: PatientRpcName,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export async function callPatientRpc<N extends PatientRpcName>(
  client: SupabaseClient<Database>,
  name: N,
  args: PatientRpcArgs<N>,
): Promise<PatientRpcResult<N>> {
  const contract = patientRpcContracts[name];
  const validatedArgs = contract.args.parse(args);
  // Sole transport cast: generated RPC nullability is narrower than PostgreSQL's real contract.
  // The app-facing args and every returned row are checked by the SQL-derived Zod contract here.
  const rpc = client.rpc as unknown as PatientTransport;
  const { data, error } = await rpc.call(client, name, validatedArgs);
  if (error) throw error;
  return contract.returns.parse(data) as PatientRpcResult<N>;
}
