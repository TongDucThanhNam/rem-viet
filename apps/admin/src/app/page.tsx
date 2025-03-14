"use client";

import React, {useState} from "react";
import {Button, Checkbox, Divider, Input, Link} from "@nextui-org/react";

import {GithubIcon, Google, SolarEyeBold, SolarEyeClosedLinear,} from "@/components/icons/icons";
import {useRouter} from "next/navigation";

// import {AcmeIcon} from "./acme";

export default function Component() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // In a real app, you'd make an API call to authenticate
        if (username === 'mart24vn' && password === '12345678') {
            // Set a cookie or token to indicate the user is logged in
            document.cookie = 'isLoggedIn=true; path=/'
            router.push('/dashboard')
        } else {
            alert('Invalid credentials')
        }
    }

    const [isVisible, setIsVisible] = React.useState(false);

    const toggleVisibility = () => setIsVisible(!isVisible);

    return (
        <div
            className="flex h-screen w-screen items-center justify-end overflow-hidden rounded-small bg-content1 p-2 sm:p-4 lg:p-8"
            style={{
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            {/* Brand Logo */}
            <div className="absolute left-10 top-10">
                <div className="flex items-center">
                    {/*<Icon className="text-white"  icon={}/>*/}
                    <p className="font-medium text-white">Rèm Việt</p>
                </div>
            </div>

            {/* Testimonial */}
            <div className="absolute bottom-10 left-10 hidden md:block">
                <p className="max-w-xl text-white/60">
                    <span className="font-medium">“</span>
                    Cổng đăng nhập vào hệ thống Rèm Việt
                    <span className="font-medium">”</span>
                </p>
            </div>

            {/* Login Form */}
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-large bg-content1 px-8 pb-10 pt-6 shadow-small">
                <p className="pb-2 text-xl font-medium">Đăng nhập</p>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={handleSubmit}
                >
                    <Input
                        label="Tên đăng nhập"
                        name="username"
                        placeholder="Nhập tên đăng nhập"
                        type="text"
                        variant="bordered"
                        value={username}
                        onValueChange={(value) => setUsername(value)}
                    />
                    <Input
                        endContent={
                            <button type="button" onClick={toggleVisibility}>
                                {isVisible ? <SolarEyeClosedLinear/> : <SolarEyeBold/>}
                            </button>
                        }
                        label="Mật khẩu"
                        name="password"
                        placeholder="Nhập mật khẩu của bạn"
                        type={isVisible ? "text" : "password"}
                        variant="bordered"
                        value={password}
                        onValueChange={(value) => setPassword(value)}
                    />
                    <div className="flex items-center justify-between px-1 py-2">
                        <Checkbox name="remember" size="sm">
                            Ghi nhớ đăng nhập
                        </Checkbox>
                        <Link className="text-default-500" href="/quen-mat-khau" size="sm">
                            Quên mật khẩu?
                        </Link>
                    </div>
                    <Button color="primary" type="submit">
                        Đăng nhập
                    </Button>
                </form>
                <div className="flex items-center gap-4 py-2">
                    <Divider className="flex-1"/>
                    <p className="shrink-0 text-tiny text-default-500">OR</p>
                    <Divider className="flex-1"/>
                </div>
                <div className="flex flex-col gap-2">
                    <Button startContent={<Google/>} variant="bordered">
                        Đăng nhập bằng Google
                    </Button>
                    <Button startContent={<GithubIcon/>} variant="bordered">
                        Đăng nhập bằng Github
                    </Button>
                </div>
                <p className="text-center text-small">
                    Chưa có tài khoản?&nbsp;
                    <Link href="/dang-ky" size="sm">
                        Đăng ký ngay
                    </Link>
                </p>
            </div>
        </div>
    );
}
