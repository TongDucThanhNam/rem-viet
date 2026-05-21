import { createFileRoute, useNavigate } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/dang-nhap")({
  component: DangNhapRoute,
});

function DangNhapRoute() {
  const navigate = useNavigate();

  return <SignInForm onSwitchToSignUp={() => navigate({ to: "/dang-ky" })} />;
}
