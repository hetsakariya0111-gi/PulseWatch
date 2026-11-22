"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // The server cannot know the resolved theme, so a stable placeholder is
  // rendered until hydration completes. useSyncExternalStore returns the
  // server snapshot (false) during SSR/initial render and the client snapshot
  // (true) afterwards — no state update inside an effect required.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? (
          <SunIcon className="size-4" />
        ) : (
          <MoonIcon className="size-4" />
        )
      ) : (
        <span className="size-4" />
      )}
    </Button>
  );
}
