// Landing page behaviour. Stores nothing, like the app itself.
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);

  // Theme toggle
  $("#theme-toggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    $('meta[name="theme-color"]').content = root.dataset.theme === "light" ? "#f8fafc" : "#020617";
  });

  // Sticky nav backdrop
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const menu = $("#menu-toggle"), links = $("#nav-links");
  const setMenu = (open) => { links.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); };
  menu.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  links.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));
  addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    io.observe(el);
  });

  // Hero demo: score fills, Gen AI is bridged from existing evidence, the bullet is rephrased, truth check passes.
  const SCORE = 86;
  const AFTER = [["Built "], ["Gen AI", true], [" apps with LangChain and the Claude SDK"]];
  const fill = $("#gauge-fill"), score = $("#score"), typed = $("#typed"), chip = $("#chip-genai"), foot = $("#demo-foot");
  const C = 2 * Math.PI * 50;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const render = (n) => {
    let left = n;
    typed.innerHTML = AFTER.map(([t, hi]) => {
      const part = t.slice(0, Math.max(0, left)); left -= t.length;
      return hi && part ? `<mark>${part}</mark>` : part;
    }).join("");
  };
  const total = AFTER.reduce((a, [t]) => a + t.length, 0);

  async function play() {
    fill.style.strokeDashoffset = C * (1 - SCORE / 100);
    if (reduced) { score.textContent = SCORE; chip.classList.add("on"); render(total); foot.classList.add("on"); return; }
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / 1600);
        score.textContent = Math.round(SCORE * (1 - Math.pow(1 - p, 3)));
        p < 1 ? requestAnimationFrame(tick) : done();
      };
      requestAnimationFrame(tick);
    });
    await wait(300);
    chip.classList.add("on");
    await wait(500);
    for (let i = 1; i <= total; i++) { render(i); await wait(28); }
    await wait(250);
    foot.classList.add("on");
  }
  const demo = $("#demo");
  const demoIo = new IntersectionObserver(([e]) => { if (e.isIntersecting) { demoIo.disconnect(); play(); } }, { threshold: 0.4 });
  demoIo.observe(demo);

  // Install tabs
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    }
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });

  // Copy buttons
  document.querySelectorAll(".copy").forEach((btn) => btn.addEventListener("click", async () => {
    const text = btn.parentElement.querySelector("code").innerText;
    try { await navigator.clipboard.writeText(text); } catch { return; }
    const label = btn.querySelector("span");
    btn.classList.add("done"); label.textContent = "Copied";
    setTimeout(() => { btn.classList.remove("done"); label.textContent = "Copy"; }, 1600);
  }));
})();
