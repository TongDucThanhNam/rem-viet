"use client";

import React from "react";
import {Button, Checkbox, Divider, Input, Link} from "@nextui-org/react";
import {RemVietIcon} from "@/components/icons/remviet";
import {GithubIcon, Google, SolarEyeBold, SolarEyeClosedLinear} from "@/components/icons/icons";

export default function RegisterForm() {
    const [isVisible, setIsVisible] = React.useState(false);
    const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);

    const toggleVisibility = () => setIsVisible(!isVisible);
    const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

    return (
        <div
            className="flex h-screen w-screen items-center justify-end overflow-hidden rounded-small bg-content1 p-2 sm:p-4 lg:p-8"
            style={{
                backgroundImage:
                    "url(https://nextuipro.nyc3.cdn.digitaloceanspaces.com/components-images/black-background-texture.jpeg)",
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            {/* Logo Thương Hiệu */}
            <div className="absolute left-10 top-10">
                <div className="flex items-center">
                    <RemVietIcon className="text-white" size={40}/>
                    <p className="font-medium text-white">ACME</p>
                </div>
            </div>

            {/* Lời Chứng Thực */}
            <div className="absolute bottom-10 left-10 hidden md:block">
                <p className="max-w-xl text-white/60">
                    <span className="font-medium">“</span>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc eget augue nec massa
                    volutpat aliquet.
                    <span className="font-medium">”</span>
                </p>
            </div>

            {/* Biểu Mẫu Đăng Ký */}
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-large bg-content1 px-8 pb-10 pt-6 shadow-small">
                <p className="pb-2 text-xl font-medium">Đăng Ký</p>
                <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
                    <Input
                        isRequired
                        label="Địa Chỉ Email"
                        name="email"
                        placeholder="Nhập email của bạn"
                        type="email"
                        variant="bordered"
                    />
                    <Input
                        isRequired
                        endContent={
                            <button type="button" onClick={toggleVisibility}>
                                {isVisible ? (
                                    <SolarEyeClosedLinear/>
                                ) : (
                                    <SolarEyeBold/>
                                )}
                            </button>
                        }
                        label="Mật Khẩu"
                        name="password"
                        placeholder="Nhập mật khẩu của bạn"
                        type={isVisible ? "text" : "password"}
                        variant="bordered"
                    />
                    <Input
                        isRequired
                        endContent={
                            <button type="button" onClick={toggleConfirmVisibility}>
                                {isConfirmVisible ? (
                                    <SolarEyeClosedLinear/>
                                ) : (
                                    <SolarEyeBold/>
                                )}
                            </button>
                        }
                        label="Xác Nhận Mật Khẩu"
                        name="confirmPassword"
                        placeholder="Xác nhận mật khẩu của bạn"
                        type={isConfirmVisible ? "text" : "password"}
                        variant="bordered"
                    />
                    <Checkbox isRequired className="py-4" size="sm">
                        Tôi đồng ý với&nbsp;
                        <Link href="#" size="sm">
                            Điều Khoản
                        </Link>
                        &nbsp; và&nbsp;
                        <Link href="#" size="sm">
                            Chính Sách Bảo Mật
                        </Link>
                    </Checkbox>
                    <Button color="primary" type="submit">
                        Đăng Ký
                    </Button>
                </form>
                <div className="flex items-center gap-4 py-2">
                    <Divider className="flex-1"/>
                    <p className="shrink-0 text-tiny text-default-500">HOẶC</p>
                    <Divider className="flex-1"/>
                </div>
                <div className="flex flex-col gap-2">
                    <Button
                        startContent={<Google/>}
                        variant="bordered"
                    >
                        Tiếp Tục với Google
                    </Button>
                    <Button
                        startContent={<GithubIcon/>}
                        variant="bordered"
                    >
                        Tiếp Tục với Github
                    </Button>
                </div>
                <p className="text-center text-small">
                    Đã có tài khoản?&nbsp;
                    <Link href="/" size="sm">
                        Đăng Nhập
                    </Link>
                </p>
            </div>
        </div>
    );
}