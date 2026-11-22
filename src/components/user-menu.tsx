"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/modules/auth/actions";

/**
 * Account menu in the app header.
 *
 * Sign-out runs through the `signOutAction` server action rather than a plain
 * link so the session cookie is cleared on the server. It is wrapped in a
 * transition because the action ends in a redirect, and we want the menu item
 * to show a pending state until that redirect lands.
 */
export function UserMenu({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  const label = name ?? email ?? "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar>
            {image !== null ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{label}</span>
          {email !== null ? (
            <span className="text-muted-foreground text-xs font-normal">{email}</span>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            // Keep the menu open while the redirect is in flight.
            event.preventDefault();
            startTransition(() => {
              void signOutAction();
            });
          }}
        >
          <LogOut />
          {isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
