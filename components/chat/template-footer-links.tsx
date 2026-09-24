"use client";

export function TemplateFooterLinks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pb-2 text-xs text-muted-foreground">
      <span>Dated research snapshot — verify at</span>
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://leginfo.legislature.ca.gov"
        rel="noopener noreferrer"
        target="_blank"
      >
        leginfo.legislature.ca.gov
      </a>
      <span>· Not legal advice.</span>
    </div>
  );
}
