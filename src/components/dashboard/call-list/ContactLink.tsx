export interface ContactLinkProps {
  email: string | null;
  /** "link" inline under the name; "button" as a full-width tap target on mobile cards. */
  variant?: "link" | "button";
}

export function ContactLink({ email, variant = "link" }: ContactLinkProps) {
  if (!email) return <span className="text-xs text-muted">No billing contact</span>;
  if (variant === "button") {
    return (
      <a
        href={`mailto:${email}`}
        className="shrink-0 rounded-lg border border-line bg-page px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-2"
        title={email}
        aria-label={`Email ${email}`}
      >
        Email client
      </a>
    );
  }
  return (
    <a href={`mailto:${email}`} className="block truncate text-xs text-accent underline-offset-4 hover:underline">
      {email}
    </a>
  );
}
