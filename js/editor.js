(function () {
  const API = "/api";

  async function api(path, opts) {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.status);
    return data;
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 2400);
  }

  function makeEditable(el) {
    if (el.dataset.editable) return;
    el.dataset.editable = "1";
    el.addEventListener("click", async (e) => {
      if (!window.__editMode) return;
      e.preventDefault();
      try {
        await ensureAuth();
      } catch {
        toast("Please log in to edit");
        return;
      }
      const path = el.getAttribute("data-field");
      if (!path) return;
      const cur = el.textContent;
      const input = document.createElement("input");
      input.type = "text";
      input.value = cur;
      el.textContent = "";
      el.appendChild(input);
      input.focus();
      const save = async () => {
        try {
          await api("/content", { method: "PUT", body: { op: "update", path, value: input.value } });
          el.textContent = input.value;
          toast("Saved draft");
        } catch (err) {
          el.textContent = input.value || cur;
          toast(err.message || "Save failed");
        }
      };
      input.addEventListener("blur", save);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
    });
  }

  async function ensureAuth() {
    const localUser = localStorage.getItem("navas_email");
    if (!localUser) {
      return new Promise((resolve) => {
        const modal = document.getElementById("auth-modal");
        modal.classList.remove("hidden");
        const finish = async () => {
          const email = document.getElementById("auth-email")?.value?.trim();
          const password = document.getElementById("auth-password")?.value;
          if (!email || !password) return;
          try {
            await api("/auth/register", { method: "POST", body: { email, password } });
            localStorage.setItem("navas_email", email);
            modal.classList.add("hidden");
            resolve();
          } catch {
            try {
              await api("/auth/login", { method: "POST", body: { email, password } });
              localStorage.setItem("navas_email", email);
              modal.classList.add("hidden");
              resolve();
            } catch (e) {
              toast(e.message || "Auth failed");
              throw e;
            }
          }
        };
        document.getElementById("auth-form")?.addEventListener("submit", (e) => {
          e.preventDefault();
          finish();
        });
        document.getElementById("auth-close")?.addEventListener("click", () => modal.classList.add("hidden"));
      });
    }
    // Verify the session is still good
    try {
      await api("/auth/me");
    } catch (e) {
      localStorage.removeItem("navas_email");
      throw e;
    }
  }

  async function publish() {
    try {
      await ensureAuth();
    } catch {
      toast("Please log in to publish");
      return;
    }
    try {
      const content = await api("/content", { method: "GET" });
      await api("/publish", { method: "POST", body: content });
      toast("Published");
    } catch (e) {
      toast(e.message || "Publish failed");
    }
  }

  function draft() {
    toast("Auto-saved on every edit");
  }

  function preview() {
    const url = new URL(window.location.href);
    url.search = "?preview=1";
    window.open(url.toString(), "_blank");
  }

  async function logout() {
    await fetch(API + "/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    localStorage.removeItem("navas_email");
    toast("Logged out");
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-edit")?.addEventListener("click", () => {
      window.__editMode = !window.__editMode;
      document.querySelectorAll("[data-field]").forEach((el) => {
        if (window.__editMode) makeEditable(el);
      });
      toast(window.__editMode ? "Edit mode on" : "Edit mode off");
    });
    document.getElementById("btn-draft")?.addEventListener("click", draft);
    document.getElementById("btn-publish")?.addEventListener("click", publish);
    document.getElementById("btn-preview")?.addEventListener("click", preview);
    document.getElementById("btn-logout")?.addEventListener("click", logout);
  });
})();
