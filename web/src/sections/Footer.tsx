import { ArrowRight } from "lucide-react";
import { ButtonLink, GithubIcon, Reveal } from "@/components/ui";
import { asset, REPO } from "@/lib/utils";

export function FinalCta() {
  return (
    <section className="relative pb-24 pt-8">
      <div className="wrap">
        <Reveal className="glass relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden
            style={{ background: "radial-gradient(60% 80% at 50% 0%, hsl(var(--aurora-1)), transparent 70%), radial-gradient(40% 60% at 85% 100%, hsl(var(--aurora-3)), transparent 70%)" }} />
          <h2 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold tracking-tight sm:text-5xl sm:leading-[1.08]">
            Get your resume in front of a human. <span className="text-gradient">Honestly.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Free, open source and yours to run. Read the code, star the repo, or open a pull request.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href={REPO} target="_blank" rel="noopener"><GithubIcon /> Star on GitHub</ButtonLink>
            <ButtonLink href="#start" variant="ghost">Run it locally <ArrowRight /></ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-8 text-sm text-muted-foreground">
      <div className="wrap flex flex-wrap items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2 font-semibold text-foreground">
          <img src={asset("favicon.svg")} alt="" width={20} height={20} className="rounded-md" /> TailorUrResume
        </a>
        <p>Apache-2.0 · Built with FastAPI and React</p>
        <nav aria-label="Footer" className="flex gap-5">
          <a className="hover:text-foreground" href={REPO} target="_blank" rel="noopener">GitHub</a>
          <a className="hover:text-foreground" href={`${REPO}#readme`} target="_blank" rel="noopener">Docs</a>
          <a className="hover:text-foreground" href={`${REPO}/issues`} target="_blank" rel="noopener">Issues</a>
        </nav>
      </div>
    </footer>
  );
}
