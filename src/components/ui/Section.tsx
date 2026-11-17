import type { ReactNode } from "react";

export interface SectionProps {
  id: string;
  eyebrow?: string;
  title: string;
  insight?: ReactNode;
  children: ReactNode;
}

/** A titled dashboard block. No card chrome: a hairline and whitespace separate sections. */
export function Section({ id, eyebrow, title, insight, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line pt-8 sm:pt-10">
      <header className="mb-6 max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</p>}
        <h2 id={`${id}-title`} className="mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        {insight && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{insight}</p>}
      </header>
      {children}
    </section>
  );
}
