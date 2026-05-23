import { Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { SaasLayout } from "@/components/layout/SaasLayout";

interface SaasRouteProps {
  children: React.ReactNode;
}

export function SaasRoute({ children }: SaasRouteProps) {
  const { user } = useAuth();

  if (!user || user.role !== "dev") {
    return <Redirect to="/login" />;
  }

  return <SaasLayout>{children}</SaasLayout>;
}
