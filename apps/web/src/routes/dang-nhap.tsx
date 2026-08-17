import { createFileRoute } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/dang-nhap")({
  component: DangNhapRoute,
});

function DangNhapRoute() {
  return <SignInForm />;
}
