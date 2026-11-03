import Link from "next/link";
import { AuthCard } from "@/modules/access/components/auth-card";
import { RecoveryForm } from "@/modules/access/components/recovery-form";

export default function ForgotPasswordPage() {
  if (process.env.PORTFOLIO_DEMO_MODE === "true") {
    return (
      <AuthCard title="Recuperar contraseña" description="Demo de solo lectura">
        <p>Disponible en la versión completa. Esta demo es de solo lectura.</p>
        <Link className="mt-4 inline-block font-medium text-sky-700 underline" href="/login">
          Volver al login
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      description="Ingresá tu email y, si existe una cuenta asociada, te enviaremos instrucciones."
      title="Recuperar contraseña"
    >
      <RecoveryForm />
    </AuthCard>
  );
}
