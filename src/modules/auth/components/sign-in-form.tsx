"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/modules/auth/actions";
import { initialFormState } from "@/modules/auth/form-state";

function FieldError({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) return null;
  return <p className="text-destructive text-xs">{messages[0]}</p>;
}

export function SignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {callbackUrl !== undefined ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      {state.message !== undefined ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={state.fieldErrors?.email !== undefined}
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password !== undefined}
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/sign-up" className="underline underline-offset-4">
          Need an account?
        </Link>
      </p>
    </form>
  );
}
