import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/modules/auth/session";

import { OAuthButtons } from "@/modules/auth/components/oauth-buttons";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user !== null) redirect("/dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start monitoring your websites and APIs in under a minute.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignUpForm />
        <OAuthButtons />
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <a href="/sign-in" className="text-foreground font-medium underline underline-offset-4">
            Sign in
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
