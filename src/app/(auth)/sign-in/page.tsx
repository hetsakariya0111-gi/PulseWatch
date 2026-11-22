import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/modules/auth/session";

import { OAuthButtons } from "@/modules/auth/components/oauth-buttons";
import { SignInForm } from "@/modules/auth/components/sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getCurrentUser();
  if (user !== null) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignInForm callbackUrl={callbackUrl} />
        <OAuthButtons />
        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{" "}
          <a href="/sign-up" className="text-foreground font-medium underline underline-offset-4">
            Create one
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
