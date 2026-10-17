(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const stars = document.getElementById("stars");
  if (stars) {
    const count = window.matchMedia("(max-width: 720px)").matches ? 36 : 64;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement("span");
      star.className = "hero__star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.setProperty("--dur", `${3 + Math.random() * 5}s`);
      star.style.setProperty("--delay", `${Math.random() * 4}s`);
      frag.appendChild(star);
    }
    stars.appendChild(frag);
  }

  const revealTargets = document.querySelectorAll(
    ".about .section__inner, .works .section__inner > *:not(.works__list), .work, .contact .section__inner"
  );
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  // Subtle parallax on the moon for a smoother feel
  const moon = document.querySelector(".hero__moon");
  const glow = document.querySelector(".hero__glow");
  if (moon && glow && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let ticking = false;
    window.addEventListener(
      "pointermove",
      (e) => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth - 0.5) * 16;
          const y = (e.clientY / window.innerHeight - 0.5) * 12;
          moon.style.translate = `${x}px ${y}px`;
          glow.style.translate = `${x * 0.6}px ${y * 0.6}px`;
          ticking = false;
        });
      },
      { passive: true }
    );
  }
})();
