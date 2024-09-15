import { Spacer } from "@nextui-org/react";

import { RegisterForm } from "@/components/form/register-form";

export default function LoginPage() {
  return (
    <div className="flex h-dvh	justify-center">
      <div className="flex-col w-1/2 ">
        <div className="flex-col justify-center text-center">
          <Spacer y={40} />

          <h2 className="text-2xl"> Sign up to use </h2>
          <Spacer />
        </div>

        <div className="flex justify-center text-center">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
