// CampusKart backend - clean fixed version

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const DB_FILE = process.env.DB_FILE || "./campuskart.db";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";
const COLLEGE_DOMAIN =
  process.env.COLLEGE_DOMAIN || "imsengineeringcollege.edu";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@imsengineeringcollege.edu";

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Initialize DB if missing
if (!fs.existsSync(DB_FILE)) {
  const initSql = fs.readFileSync(
    path.join(__dirname, "db", "init.sql"),
    "utf8"
  );
  fs.writeFileSync(DB_FILE, "");
  const tmp = new sqlite3.Database(DB_FILE);
  tmp.exec(initSql, (err) => {
    if (err) console.error("DB init error:", err);
    tmp.close();
  });
}

const db = new sqlite3.Database(DB_FILE);

// Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static(path.join(__dirname, "public")));

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const safe = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Helpers
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.email === ADMIN_EMAIL) return next();
  return res.status(403).json({ message: "Not admin" });
}

// ========== AUTH ==========

app.post("/api/signup", async (req, res) => {
  const { name, email, password, college } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const lowerEmail = String(email).toLowerCase();
  if (!lowerEmail.endsWith("@" + COLLEGE_DOMAIN)) {
    return res.status(400).json({
      message: "Use college email ending with @" + COLLEGE_DOMAIN,
    });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(
      "INSERT INTO users (name, email, password, college) VALUES (?, ?, ?, ?)"
    );
    stmt.run(
      name,
      lowerEmail,
      hash,
      college || "",
      function (err) {
        if (err) {
          return res
            .status(400)
            .json({ message: "Email already registered" });
        }
        const user = { id: this.lastID, name, email: lowerEmail };
        const token = generateToken(user);
        res.json({ user, token });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Missing fields" });

  const lowerEmail = String(email).toLowerCase();

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [lowerEmail],
    async (err, row) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!row)
        return res.status(401).json({ message: "Invalid credentials" });

      const ok = await bcrypt.compare(password, row.password);
      if (!ok)
        return res.status(401).json({ message: "Invalid credentials" });

      const user = { id: row.id, name: row.name, email: row.email };
      const token = generateToken(user);
      res.json({ user, token });
    }
  );
});

// ========== PROFILE ==========

app.get("/api/profile", authMiddleware, (req, res) => {
  db.get(
    "SELECT id, name, email, college, profile_pic, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ user: row });
    }
  );
});

app.post("/api/profile", authMiddleware, (req, res) => {
  const { name, college, profile_pic } = req.body;
  const stmt = db.prepare(
    "UPDATE users SET name = ?, college = ?, profile_pic = ? WHERE id = ?"
  );
  stmt.run(
    name,
    college,
    profile_pic,
    req.user.id,
    function (err) {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ ok: true });
    }
  );
});

app.post(
  "/api/profile/picture",
  authMiddleware,
  upload.single("profile_pic"),
  (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "No file uploaded" });

    const picPath = "/uploads/" + req.file.filename;
    const stmt = db.prepare("UPDATE users SET profile_pic = ? WHERE id = ?");
    stmt.run(
      picPath,
      req.user.id,
      function (err) {
        if (err) return res.status(500).json({ message: "Server error" });
        res.json({ ok: true, profile_pic: picPath });
      }
    );
  }
);

// ========== NOTES ==========

app.post(
  "/api/notes",
  authMiddleware,
  upload.single("file"),
  (req, res) => {
    const { title, description, course, tags } = req.body;
    if (!title)
      return res.status(400).json({ message: "Title required" });

    let filename = "";
    if (req.file) {
      filename = "/uploads/" + req.file.filename;
    }

    const stmt = db.prepare(
      "INSERT INTO notes (user_id, title, filename, description, course, tags) VALUES (?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      req.user.id,
      title,
      filename,
      description || "",
      course || "",
      tags || "",
      function (err) {
        if (err) return res.status(500).json({ message: "Server error" });
        res.json({ id: this.lastID, filename });
      }
    );
  }
);

app.get("/api/notes", (req, res) => {
  const q = req.query.q || "";
  const course = req.query.course || "";
  const tag = req.query.tag || "";
  const limit = parseInt(req.query.limit || "50", 10);

  let sql =
    "SELECT n.*, u.name AS author, " +
    "IFNULL(AVG(r.rating),0) AS avg_rating, COUNT(r.id) AS rating_count " +
    "FROM notes n " +
    "LEFT JOIN users u ON u.id = n.user_id " +
    "LEFT JOIN note_ratings r ON r.note_id = n.id " +
    "WHERE 1=1 ";
  const params = [];

  if (q) {
    sql += "AND (n.title LIKE ? OR n.description LIKE ?) ";
    params.push("%" + q + "%", "%" + q + "%");
  }
  if (course) {
    sql += "AND n.course = ? ";
    params.push(course);
  }
  if (tag) {
    sql += "AND n.tags LIKE ? ";
    params.push("%" + tag + "%");
  }

  sql += "GROUP BY n.id ORDER BY n.created_at DESC LIMIT ? ";
  params.push(limit);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(rows);
  });
});

app.get("/api/notes/:id/comments", (req, res) => {
  db.all(
    "SELECT c.*, u.name AS author " +
      "FROM note_comments c " +
      "LEFT JOIN users u ON u.id = c.user_id " +
      "WHERE c.note_id = ? ORDER BY c.created_at DESC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json(rows);
    }
  );
});

app.post("/api/notes/:id/comments", authMiddleware, (req, res) => {
  const comment = req.body.comment;
  if (!comment)
    return res.status(400).json({ message: "Comment required" });

  const stmt = db.prepare(
    "INSERT INTO note_comments (note_id, user_id, comment) VALUES (?, ?, ?)"
  );
  stmt.run(
    req.params.id,
    req.user.id,
    comment,
    function (err) {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ id: this.lastID });
    }
  );
});

app.post("/api/notes/:id/rating", authMiddleware, (req, res) => {
  const rating = parseInt(req.body.rating, 10);
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating 1-5 required" });
  }

  db.get(
    "SELECT id FROM note_ratings WHERE note_id = ? AND user_id = ?",
    [req.params.id, req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Server error" });

      if (row) {
        const stmt = db.prepare(
          "UPDATE note_ratings SET rating = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?"
        );
        stmt.run(
          rating,
          row.id,
          function (e2) {
            if (e2) return res.status(500).json({ message: "Server error" });
            res.json({ ok: true });
          }
        );
      } else {
        const stmt = db.prepare(
          "INSERT INTO note_ratings (note_id, user_id, rating) VALUES (?, ?, ?)"
        );
        stmt.run(
          req.params.id,
          req.user.id,
          rating,
          function (e2) {
            if (e2) return res.status(500).json({ message: "Server error" });
            res.json({ ok: true });
          }
        );
      }
    }
  );
});

app.post("/api/notes/:id/bookmark", authMiddleware, (req, res) => {
  const noteId = req.params.id;
  db.get(
    "SELECT id FROM note_bookmarks WHERE note_id = ? AND user_id = ?",
    [noteId, req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Server error" });

      if (row) {
        db.run(
          "DELETE FROM note_bookmarks WHERE id = ?",
          [row.id],
          function (e2) {
            if (e2) return res.status(500).json({ message: "Server error" });
            res.json({ bookmarked: false });
          }
        );
      } else {
        db.run(
          "INSERT INTO note_bookmarks (note_id, user_id) VALUES (?, ?)",
          [noteId, req.user.id],
          function (e2) {
            if (e2) return res.status(500).json({ message: "Server error" });
            res.json({ bookmarked: true });
          }
        );
      }
    }
  );
});

app.get("/api/notes-bookmarked", authMiddleware, (req, res) => {
  const sql =
    "SELECT n.*, u.name AS author, " +
    "IFNULL(AVG(r.rating),0) AS avg_rating, COUNT(r.id) AS rating_count " +
    "FROM note_bookmarks b " +
    "JOIN notes n ON n.id = b.note_id " +
    "LEFT JOIN users u ON u.id = n.user_id " +
    "LEFT JOIN note_ratings r ON r.note_id = n.id " +
    "WHERE b.user_id = ? " +
    "GROUP BY n.id ORDER BY b.created_at DESC";

  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(rows);
  });
});

// ========== MARKETPLACE ==========

app.post(
  "/api/items",
  authMiddleware,
  upload.single("image"),
  (req, res) => {
    const { name, price, description, contact_email } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    let imageUrl = "";
    if (req.file) {
      imageUrl = "/uploads/" + req.file.filename;
    }

    const stmt = db.prepare(
      "INSERT INTO items (user_id, name, price, description, contact_email, image_url) VALUES (?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      req.user.id,
      name,
      price || 0,
      description || "",
      contact_email || req.user.email,
      imageUrl,
      function (err) {
        if (err) return res.status(500).json({ message: "Server error" });
        res.json({ id: this.lastID, image_url: imageUrl });
      }
    );
  }
);

app.get("/api/items", (req, res) => {
  const q = req.query.q || "";
  const limit = parseInt(req.query.limit || "50", 10);

  let sql =
    "SELECT i.*, u.name AS seller FROM items i " +
    "LEFT JOIN users u ON u.id = i.user_id WHERE 1=1 ";
  const params = [];

  if (q) {
    sql += "AND (i.name LIKE ? OR i.description LIKE ?) ";
    params.push("%" + q + "%", "%" + q + "%");
  }

  sql += "ORDER BY i.created_at DESC LIMIT ? ";
  params.push(limit);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(rows);
  });
});

// ========== LOST & FOUND ==========

app.post("/api/lostfound", authMiddleware, (req, res) => {
  const { type, description, location, contact_email } = req.body;
  const stmt = db.prepare(
    "INSERT INTO lostfound (user_id, type, description, location, contact_email) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(
    req.user.id,
    type,
    description,
    location,
    contact_email || req.user.email,
    function (err) {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ id: this.lastID });
    }
  );
});

app.get("/api/lostfound", (req, res) => {
  db.all(
    "SELECT l.*, u.name AS reporter FROM lostfound l " +
      "LEFT JOIN users u ON u.id = l.user_id " +
      "ORDER BY l.created_at DESC LIMIT 200",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json(rows);
    }
  );
});

// ========== ADMIN ==========

app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => {
  const stats = {};
  db.serialize(() => {
    db.get("SELECT COUNT(*) AS c FROM users", (e1, r1) => {
      if (e1) return res.status(500).json({ message: "Server error" });
      stats.users = r1.c;
      db.get("SELECT COUNT(*) AS c FROM notes", (e2, r2) => {
        if (e2) return res.status(500).json({ message: "Server error" });
        stats.notes = r2.c;
        db.get("SELECT COUNT(*) AS c FROM items", (e3, r3) => {
          if (e3) return res.status(500).json({ message: "Server error" });
          stats.items = r3.c;
          db.get("SELECT COUNT(*) AS c FROM lostfound", (e4, r4) => {
            if (e4) return res.status(500).json({ message: "Server error" });
            stats.lostfound = r4.c;
            res.json(stats);
          });
        });
      });
    });
  });
});

// health
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Start server
app.listen(PORT, () => {
  console.log("CampusKart backend running on port", PORT);
});