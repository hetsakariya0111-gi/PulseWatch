"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/modules/auth/actions";
import { initialFormState } from "@/modules/auth/form-state";

function FieldError({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) return null;
  return <p className="text-destructive text-xs">{messages[0]}</p>;
}

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message !== undefined ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required />
        <FieldError messages={state.fieldErrors?.name} />
      </div>

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
          autoComplete="new-password"
          required
          aria-invalid={state.fieldErrors?.password !== undefined}
        />
        <FieldError messages={state.fieldErrors?.password} />
        <p className="text-muted-foreground text-xs">
          At least 8 characters, with an uppercase letter, a lowercase letter and a number.
        </p>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
