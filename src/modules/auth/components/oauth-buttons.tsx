import { Button } from "@/components/ui/button";
import { signInWithGitHubAction } from "@/modules/auth/actions";

/**
 * Brand marks were dropped from lucide-react, so the GitHub logo is inlined.
 * It is decorative next to the "Continue with GitHub" label, hence aria-hidden.
 */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.98c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.07.78 2.15v3.19c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

/**
 * GitHub OAuth entry point. Rendered as a form so it works without client JS,
 * and disabled automatically when the server has no GitHub credentials.
 */
export function OAuthButtons() {
  const githubEnabled =
    process.env.AUTH_GITHUB_ID !== undefined && process.env.AUTH_GITHUB_ID !== "";

  if (!githubEnabled) return null;

  return (
    <form action={signInWithGitHubAction} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs uppercase">or</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <Button type="submit" variant="outline" className="w-full">
        <GitHubMark className="size-4" />
        Continue with GitHub
      </Button>
    </form>
  );
}

