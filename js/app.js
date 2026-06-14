(function () {
  const API = "/api";
  let content = {};

  async function load() {
    const res = await fetch(API + "/content");
    content = await res.json();
    render();
    if (window.location.search.includes("preview=1")) {
      window.__previewMode = true;
    }
  }

  function val(path, fallback) {
    const keys = String(path).split(".");
    let cur = content;
    for (const k of keys) {
      if (cur && typeof cur === "object" && k in cur) cur = cur[k];
      else return fallback !== undefined ? fallback : "";
    }
    return cur;
  }

  function render() {
    document.title = val("site_title", "Navas Barbershop");

    // Text fields
    document.querySelectorAll("[data-field]").forEach((el) => {
      const path = el.getAttribute("data-field");
      const text = val(path);
      if (text && el.children.length === 0 && !/background/i.test(el.tagName)) {
        el.textContent = text;
      }
    });

    // Hours
    const hoursData = val("contact.hours", {});
    const list = document.getElementById("hours-list");
    if (list) {
      list.innerHTML = Object.entries(hoursData)
        .map(([day, time]) => `<div><span>${day}</span><span>${time}</span></div>`)
        .join("");
    }

    // Services
    const svcContainer = document.querySelector(".services-grid");
    const svcTemplate = document.getElementById("services-template");
    if (svcContainer && svcTemplate) {
      const items = val("services.items", []);
      svcContainer.innerHTML = "";
      items.forEach((s, i) => {
        const clone = svcTemplate.content.cloneNode(true);
        clone.querySelector("[data-field='services.items.{i}.name']").textContent = s.name || "";
        clone.querySelector("[data-field='services.items.{i}.desc']").textContent = s.desc || "";
        clone.querySelector("[data-field='services.items.{i}.price']").textContent = s.price || "";
        svcContainer.appendChild(clone);
      });
    }

    // Reviews
    const revContainer = document.querySelector(".reviews-grid");
    const revTemplate = document.getElementById("reviews-template");
    if (revContainer && revTemplate) {
      const items = val("testimonials.items", []);
      revContainer.innerHTML = "";
      items.forEach((r, i) => {
        const clone = revTemplate.content.cloneNode(true);
        clone.querySelector("[data-field='testimonials.items.{i}.quote']").textContent = r.quote || "";
        clone.querySelector("[data-field='testimonials.items.{i}.name']").textContent = r.name || "";
        const stars = clone.querySelector(".stars");
        if (stars) stars.textContent = "★".repeat(r.rating || 5);
        revContainer.appendChild(clone);
      });
    }

    // Gallery
    const galGrid = document.getElementById("gallery-grid");
    const images = val("gallery.images", []);
    if (galGrid) {
      galGrid.innerHTML = images
        .map(
          (img) =>
            `<div class="gallery-item"><img src="/images/${img}" alt="Shop photo" loading="lazy"></div>`
        )
        .join("");
    }

    // Contact links
    const phone = val("contact.phone");
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      if (phone) a.setAttribute("href", "tel:" + phone.replace(/[^0-9+]/g, ""));
    });
    const cta = document.querySelector(".hero .btn-primary");
    if (cta && phone) cta.setAttribute("href", "tel:" + phone.replace(/[^0-9+]/g, ""));
  }

  window.addEventListener("DOMContentLoaded", load);
})();
