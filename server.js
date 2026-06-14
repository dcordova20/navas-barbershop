
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const IMAGES_DIR = path.join(__dirname, "images");
const AUTH_PATH = path.join(DATA_DIR, "auth.json");
const CONTENT_PATH = path.join(DATA_DIR, "content.json");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");

function ensure() {
  [DATA_DIR, IMAGES_DIR, path.join(DATA_DIR, "backups")].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  if (!fs.existsSync(AUTH_PATH)) {
    fs.writeFileSync(
      AUTH_PATH,
      JSON.stringify({ users: {} }, null, 2)
    );
  }
  if (!fs.existsSync(CONTENT_PATH)) {
    fs.writeFileSync(
      CONTENT_PATH,
      JSON.stringify(
        {
          site_title: "Navas Barbershop",
          tagline: "Classic cuts. Clean fades. Corona, CA.",
          hero: {
            headline: "Navas Barbershop",
            subhead: "Corona's trusted neighborhood barbershop. Walk-ins welcome, appointments available.",
            background_image: "",
            cta_text: "Book Now",
            cta_link: "tel:6575077000"
          },
          about: {
            headline: "About Us",
            body: "Navas Barbershop delivers precision cuts, hot towel shaves, and a relaxed atmosphere at 1510 West 6th Street #103 in Corona, CA. Open Monday through Saturday 9am-6pm and Sundays 9am-2pm.",
            image: ""
          },
          services: {
            headline: "Services",
            items: [
              { name: "Classic Haircut", desc: "Precision scissor and clipper work.", price: "$30+" },
              { name: "Skin Fade", desc: "Seamless blend from skin to length.", price: "$35+" },
              { name: "Beard Trim & Shape-Up", desc: "Clean lines with hot towel finish.", price: "$20+" },
              { name: "Hot Towel Shave", desc: "Traditional straight razor shave.", price: "$40+" }
            ]
          },
          testimonials: {
            headline: "Reviews",
            items: [
              { quote: "Best barbershop in Corona. Period.", name: "Local Customer", rating: 5 },
              { quote: "Clean shop, professional cuts, fair prices.", name: "Regular", rating: 5 }
            ]
          },
          gallery: { headline: "The Shop", images: [] },
          contact: {
            phone: "6575077000",
            address: "1510 West 6th Street #103, Corona, CA",
            hours: {
              "Monday": "9:00 AM - 6:00 PM",
              "Tuesday": "9:00 AM - 6:00 PM",
              "Wednesday": "9:00 AM - 6:00 PM",
              "Thursday": "9:00 AM - 6:00 PM",
              "Friday": "9:00 AM - 6:00 PM",
              "Saturday": "9:00 AM - 6:00 PM",
              "Sunday": "9:00 AM - 2:00 PM"
            },
            instagram: "@navasbarbershop"
          },
          footer: { copyright: " Navas Barbershop. All rights reserved." },
          placeholders: ["hero.background_image", "gallery.images", "about.image"]
        },
        null,
        2
      )
    );
  }
  if (!fs.existsSync(SESSIONS_PATH)) fs.writeFileSync(SESSIONS_PATH, JSON.stringify({}, null, 2));

  function tokenFallback() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  globalThis.__makeToken = function () {
    try {
      return crypto.randomBytes(32).toString("hex");
    } catch (e) {
      return tokenFallback();
    }
  };
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function getSession(req) {
  const cookies = req.headers.cookie || "";
  const m = cookies.match(/navas_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const sessions = readJson(SESSIONS_PATH) || {};
  const session = sessions[token];
  if (!session) return null;
  return session;
}

function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) {
    sendJson(res, 401, { error: "Auth required" });
    return null;
  }
  return s;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === "/api/content" && req.method === "GET") {
    const content = readJson(CONTENT_PATH) || {};
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(content));
    return;
  }

  if (pathname === "/api/content" && req.method === "PUT") {
    const s = requireAuth(req, res);
    if (!s) return;
    const body = [];
    req.on("data", (chunk) => body.push(chunk));
    req.on("end", () => {
      let data;
      try {
        data = JSON.parse(Buffer.concat(body).toString());
      } catch (e) {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }
      const content = readJson(CONTENT_PATH) || {};
      if (data.op === "update" && data.path && data.value !== undefined) {
        const keys = String(data.path).split(".");
        let cur = content;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!cur[keys[i]]) cur[keys[i]] = {};
          cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = data.value;
        writeJson(CONTENT_PATH, content);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (data.op === "replace" && data.content) {
        writeJson(CONTENT_PATH, data.content);
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 400, { error: "Bad op" });
    });
    return;
  }

  if (pathname === "/api/publish" && req.method === "POST") {
    const s = requireAuth(req, res);
    if (!s) return;
    const content = readJson(CONTENT_PATH) || {};
    const missing = [];
    if (!content.hero || !content.hero.headline) missing.push("hero.headline");
    if (!content.about || !content.about.body) missing.push("about.body");
    if (!content.services || !content.services.items || !content.services.items.length)
      missing.push("services.items");
    if (!content.contact || !content.contact.phone) missing.push("contact.phone");
    if (missing.length) {
      sendJson(res, 400, { error: "Missing required fields: " + missing.join(", ") });
      return;
    }
    const backupsDir = path.join(DATA_DIR, "backups");
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(CONTENT_PATH, path.join(backupsDir, "content-" + stamp + ".json"));
    writeJson(CONTENT_PATH, content);
    sendJson(res, 200, { ok: true, publishedAt: stamp });
    return;
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = [];
    req.on("data", (chunk) => body.push(chunk));
    req.on("end", () => {
      try {
        const { email, password } = JSON.parse(Buffer.concat(body).toString());
        if (!email || !password) {
          sendJson(res, 400, { error: "email and password required" });
          return;
        }
        const auth = readJson(AUTH_PATH) || { users: {} };
        if (auth.users[email]) {
          sendJson(res, 409, { error: "User already exists" });
          return;
        }
        auth.users[email] = {
          passwordHash: crypto.createHash("sha256").update(password).digest("hex")
        };
        writeJson(AUTH_PATH, auth);
        // auto-login
        const token = globalThis.__makeToken ? globalThis.__makeToken() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        const sessions = readJson(SESSIONS_PATH) || {};
        sessions[token] = { email, createdAt: Date.now() };
        writeJson(SESSIONS_PATH, sessions);
        res.writeHead(200, {
          "Set-Cookie": "navas_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly"
        });
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 400, { error: "Bad JSON" });
      }
    });
    return;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = [];
    req.on("data", (chunk) => body.push(chunk));
    req.on("end", () => {
      try {
        const { email, password } = JSON.parse(Buffer.concat(body).toString());
        const auth = readJson(AUTH_PATH) || { users: {} };
        const user = auth.users[email];
        if (!user) {
          sendJson(res, 401, { error: "Invalid credentials" });
          return;
        }
        const hash = crypto.createHash("sha256").update(password).digest("hex");
        if (hash !== user.passwordHash) {
          sendJson(res, 401, { error: "Invalid credentials" });
          return;
        }
        const token = globalThis.__makeToken ? globalThis.__makeToken() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        const sessions = readJson(SESSIONS_PATH) || {};
        sessions[token] = { email, createdAt: Date.now() };
        writeJson(SESSIONS_PATH, sessions);
        res.writeHead(200, {
          "Set-Cookie": "navas_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly"
        });
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 400, { error: "Bad JSON" });
      }
    });
    return;
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    const s = getSession(req);
    if (!s) {
      sendJson(res, 401, { error: "Not logged in" });
      return;
    }
    sendJson(res, 200, { email: s.email });
    return;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const cookies = req.headers.cookie || "";
    const m = cookies.match(/navas_session=([^;]+)/);
    if (m) {
      const token = decodeURIComponent(m[1]);
      const sessions = readJson(SESSIONS_PATH) || {};
      delete sessions[token];
      writeJson(SESSIONS_PATH, sessions);
    }
    res.writeHead(200, { "Set-Cookie": "navas_session=; Path=/; HttpOnly; Max-Age=0" });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/images" && req.method === "GET") {
    const list = fs
      .readdirSync(IMAGES_DIR)
      .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    sendJson(res, 200, { images: list });
    return;
  }

  if (pathname === "/api/upload" && req.method === "POST") {
    const s = requireAuth(req, res);
    if (!s) return;
    const ct = req.headers["content-type"] || "";
    const boundary = ct.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!boundary) {
      sendJson(res, 400, { error: "multipart required" });
      return;
    }
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      // crude multipart filename extraction
      const match = String(buf).match(/filename="([^"]+)"/);
      if (!match) {
        sendJson(res, 400, { error: "no file" });
        return;
      }
      const filename = path.basename(match[1]);
      const start = buf.indexOf(Buffer.from("\r\n\r\n")) + 4;
      const end = buf.lastIndexOf(Buffer.from("\r\n--" + boundary[1] + "--"));
      const filebuf = buf.slice(start, end > start ? end : undefined);
      const dest = path.join(IMAGES_DIR, filename);
      fs.writeFileSync(dest, filebuf);
      sendJson(res, 200, { ok: true, filename });
    });
    return;
  }

  // All other static files
  let filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (pathname.startsWith("/images/")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    filePath = path.join(__dirname, "index.html");
  }
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": (types[ext] || "application/octet-stream") });
  res.end(content);
});

ensure();
server.listen(PORT, () => {
  console.log("Site at http://localhost:" + PORT);
});
