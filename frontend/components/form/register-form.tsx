"use client";

import { Formik } from "formik";
import { Button, Divider, Input, Link, Spacer } from "@nextui-org/react";
import React from "react";

import { GithubIcon, TwitterIcon } from "@/components/icons/icons";

const defaultSignFormData = {
  username: "Ecommerse",
  password: "",
};

export const RegisterForm: React.FC = () => {
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
            <Spacer y={3} />

            {/*Phone number*/}
            <Input
              isRequired
              labelPlacement={"outside"}
              name="phone"
              size={"lg"}
              placeholder="phone: 1234567890"
              // value={values?.phone}
              // label={errors?.phone || 'Phone'}
              onBlur={handleBlur}
              onValueChange={handleChange}
            />
            <Spacer y={3} />

            {/*Password*/}
            <Input
              isRequired
              name="password"
              onBlur={handleBlur}
              onValueChange={handleChange}
              labelPlacement={"outside"}
              // status={errors?.password ? 'error' : undefined}
              label={errors?.password || "Password"}
              placeholder=""
              // labelLeft={<Password set="bold"/>}
              value={values?.password}
              type={"password"}
              // shadow={false}
              size={"lg"}
            />
            <Spacer y={3} />

            {/*Recheck input  */}
            <Input
              isRequired
              name="repassword"
              onBlur={handleBlur}
              onValueChange={handleChange}
              labelPlacement={"outside"}
              // status={errors?.password ? 'error' : undefined}
              label={errors?.password || "Re-enter Password"}
              placeholder="re-enter password"
              // labelLeft={<Password set="bold"/>}
              value={values?.password}
              type={"password"}
              // shadow={false}
              size={"lg"}
            />
            <Spacer y={1} />

            <Spacer y={1} />
            <Button className="w-full" color="primary" size="lg" type="submit">
              Sign up
            </Button>

            {/* Dont have account */}
            <Spacer y={1} />
            <div className="flex-row justify-center">
              <span>Already have an account? </span>
              <Link color="primary" href={"/login"}>
                Sign in
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
