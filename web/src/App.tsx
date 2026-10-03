import { MotionConfig } from "framer-motion";
import { Architecture } from "@/sections/Architecture";
import { Bridge } from "@/sections/Bridge";
import { Faq } from "@/sections/Faq";
import { Features } from "@/sections/Features";
import { FinalCta, Footer } from "@/sections/Footer";
import { GetStarted } from "@/sections/GetStarted";
import { Hero } from "@/sections/Hero";
import { Nav } from "@/sections/Nav";
import { Privacy } from "@/sections/Privacy";
import { Stats, Tour } from "@/sections/Tour";
import { Truth } from "@/sections/Truth";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden>
        <span className="absolute -left-[10vw] -top-[14vw] size-[46vw] rounded-full bg-[hsl(var(--aurora-1))] blur-[100px] [animation:drift_22s_ease-in-out_infinite_alternate]" />
        <span className="absolute -right-[8vw] top-[6vh] size-[38vw] rounded-full bg-[hsl(var(--aurora-2))] blur-[100px] [animation:drift_28s_ease-in-out_infinite_alternate]" />
        <span className="absolute left-[30vw] top-[55vh] size-[34vw] rounded-full bg-[hsl(var(--aurora-3))] blur-[100px] [animation:drift_34s_ease-in-out_infinite_alternate]" />
      </div>
      <div className="grain pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <Stats />
        <Tour />
        <Bridge />
        <Truth />
        <Privacy />
        <Features />
        <Architecture />
        <GetStarted />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </MotionConfig>
  );
}
