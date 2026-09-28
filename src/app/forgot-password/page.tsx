import { AuthCard } from "@/modules/access/components/auth-card";
import { RecoveryForm } from "@/modules/access/components/recovery-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Ingresá tu email y, si existe una cuenta asociada, te enviaremos instrucciones."
      title="Recuperar contraseña"
    >
      <RecoveryForm />
    </AuthCard>
  );
}
