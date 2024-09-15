"use client";

import { Formik } from "formik";
import {
  Button,
  Checkbox,
  Divider,
  Input,
  Link,
  Spacer,
} from "@nextui-org/react";
import React from "react";

import { GithubIcon, TwitterIcon } from "@/components/icons";

const defaultSignFormData = {
  username: "wangly19",
  password: "nextui.org",
};

export const LoginForm: React.FC = () => {
  // @ts-ignore
  return (
    <div className=" w-96">
      <Formik
        initialValues={defaultSignFormData}
        // validate={handleSignFormValidate}
        onSubmit={(values, { setSubmitting }) => {
          setTimeout(() => {
            setSubmitting(false);
            // toast({
            //     title: 'Welcome.',
            //     description: 'Start your trip next. ',
            // });
            // router.replace('/');
          }, 400);
        }}
      >
        {({
          values,
          errors,
          handleChange,
          isSubmitting,
          handleSubmit,
          handleBlur,
        }) => (
          <form autoComplete="off" onSubmit={handleSubmit}>
            <Input
              isRequired
              label={errors?.username || "UserName"}
              labelPlacement={"outside"}
              name="username"
              placeholder="username: Arbitrary name"
              size={"lg"}
              value={values?.username}
              onBlur={handleBlur}
              onValueChange={handleChange}
            />
            <Spacer y={2} />

            <Input
              isRequired
              label={errors?.password || "Password"}
              name="password"
              onBlur={handleBlur}
              labelPlacement={"outside"}
              // status={errors?.password ? 'error' : undefined}
              onValueChange={handleChange}
              placeholder="password: nextui.org"
              // labelLeft={<Password set="bold"/>}
              value={values?.password}
              type={"password"}
              // shadow={false}
              size={"lg"}
            />
            <Spacer y={1} />

            <div className="flex justify-between">
              <Checkbox>Remember me</Checkbox>

              <Link color="primary">Forget Password?</Link>
            </div>

            <Spacer y={1} />
            <Button className="w-full" color="primary" size="lg" type="submit">
              Sign In
            </Button>

            {/* Dont have account */}
            <Spacer y={1} />
            <div className="flex-row justify-center">
              <span>Dont have an account? </span>
              <Link color="primary" href={"/register"}>
                Sign up
              </Link>
            </div>
          </form>
        )}
      </Formik>

      <Spacer y={1} />
      <Divider />

      <Spacer y={1} />

      <div className="flex content-center justify-center">
        <Button isIconOnly={true}>
          <GithubIcon />
        </Button>

        <Spacer y={1} />
        <Button isIconOnly={true}>
          <TwitterIcon />
        </Button>
      </div>

      {/*<OtherSignInPlatform />*/}
    </div>
  );
};
