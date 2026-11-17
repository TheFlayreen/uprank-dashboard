export interface InlineScriptProps {
  html: string;
}

/**
 * A pre-paint inline script (Next.js "preventing flash before hydration" pattern).
 * The `typeof window` branch is the one sanctioned exception to the deterministic-render rule:
 * React warns when a client render produces an executable <script>, so the client renders it inert
 * (text/plain) and suppressHydrationWarning keeps the server's executable copy in the DOM.
 */
export function InlineScript({ html }: InlineScriptProps) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
