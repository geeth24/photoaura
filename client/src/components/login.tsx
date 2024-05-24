'use client';
import React, { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';

type LoginProps = {
  username: string;
  password: string;
};

function Login() {
  const [forgotPassword, setForgotPassword] = useState(false);
  const { login } = useAuth();
  const [loginProps, setLoginProps] = useState<LoginProps>({
    username: '',
    password: '',
  });

  if (forgotPassword) {
    return <ForgotPassword onBack={() => setForgotPassword(false)} />;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-10">
      <div className="w-80">
        <p className="flex flex-col text-center text-base">
          Log in to
          <span className="font-blackmud mt-4 text-3xl font-bold">PhotoAura</span>
        </p>
        <hr className="mt-4 h-1 rounded-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        <div className="mt-6 flex flex-col space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              type="text"
              placeholder="Username"
              value={loginProps.username}
              onChange={(e) => {
                setLoginProps({
                  ...loginProps,
                  username: e.target.value,
                });
              }}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              type="password"
              placeholder="Password"
              value={loginProps.password}
              onChange={(e) => {
                setLoginProps({
                  ...loginProps,
                  password: e.target.value,
                });
              }}
            />
          </div>
        </div>
        <Button
          onClick={() => {
            login(loginProps.username, loginProps.password);
          }}
          className="mt-8 w-full"
        >
          Log in
        </Button>
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setForgotPassword(true);
            }}
            className="text-sm text-zinc-500 hover:underline"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}

interface ForgotPasswordProps {
  onBack: () => void;
}

function ForgotPassword({ onBack }: ForgotPasswordProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-80">
        <p className="flex flex-col text-center text-base">
          Forgot password for
          <span className="text-3xl font-bold">PhotoAura</span>
        </p>
        <hr className="mt-4 h-1 rounded-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        <div className="mt-6 flex flex-col space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input type="text" placeholder="Username" />
          </div>
        </div>
        <Button className="mt-8 w-full">Send reset link</Button>
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              onBack();
            }}
            className="text-sm text-zinc-500 hover:underline"
          >
            Remembered password?
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
