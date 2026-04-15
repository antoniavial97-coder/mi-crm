"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto flex min-h-dvh max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="text-sm font-medium text-emerald-700">Solar CRM</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Iniciar sesión
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Acceso solo para usuarios autenticados.
            </p>
          </div>

          <div className="flex justify-center rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <SignIn routing="path" path="/login" />
          </div>
        </div>
      </div>
    </div>
  );
}

