

const apiBase = "";

// ---------- GLOBAL STATE ----------
const state = {
  token: localStorage.getItem("campuskart_token") || null,
  user: JSON.parse(localStorage.getItem("campuskart_user") || "null"),
  showingBookmarks: false,
};

// ---------- HELPERS ----------
function setToken(token, user) {
  state.token = token;
  state.user = user || null;

  if (token) {
    localStorage.setItem("campuskart_token", token);
    localStorage.setItem("campuskart_user", JSON.stringify(user || {}));
  } else {
    localStorage.removeItem("campuskart_token");
    localStorage.removeItem("campuskart_user");
  }
  updateNavAuthUI();
}

function updateNavAuthUI() {
  const protectedIds = ["notes", "market", "lostfound", "profile", "admin"];
  protectedIds.forEach((id) => {
    const btn = document.querySelector(
      '.nav button[data-section="' + id + '"]'
    );
    if (!btn) return;
    const disabled = !state.token;
    btn.disabled = disabled;
    btn.classList.toggle("disabled", disabled);
  });
}

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  const isFormData = opts.body instanceof FormData;

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (state.token) {
    headers["Authorization"] = "Bearer " + state.token;
  }

  try {
    const res = await fetch(apiBase + path, {
      ...opts,
      headers,
    });

    if (res.status === 401) {
      setToken(null, null);
      showSection("login");
      return { message: "Unauthorized" };
    }

    const data = await res.json().catch(() => ({}));
    return data;
  } catch (e) {
    console.error("API error:", e);
    return { message: "Network error" };
  }
}

// ---------- NAVIGATION ----------
function showSection(id) {
  const publicSections = ["signup", "login"];
  if (!state.token && !publicSections.includes(id)) {
    alert("Please login first");
    id = "login";
  }

  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  if (id === "notes") {
    state.showingBookmarks = false;
    loadNotes();
  }
  if (id === "market") loadItems();
  if (id === "lostfound") loadLF();
  if (id === "profile") loadProfile();
}

// attach nav clicks
document.querySelectorAll(".nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sec = btn.dataset.section;
    if (sec) showSection(sec);
  });
});

// signup / login links
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]");
  if (a && a.dataset.action === "goto") {
    e.preventDefault();
    showSection(a.dataset.target);
  }
});

// ---------- THEME TOGGLE (optional) ----------
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("change", () => {
    // currently design is dark only; no theme change
  });
}

// ---------- SIGNUP ----------
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(signupForm);
    const fd = Object.fromEntries(formData.entries());

    const res = await api("/api/signup", {
      method: "POST",
      body: JSON.stringify(fd),
    });

    if (res && res.token) {
      setToken(res.token, res.user);
      alert("Signed up successfully");
      showSection("notes");
    } else {
      alert(res.message || "Signup failed");
    }
  });
}

// ---------- LOGIN ----------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(loginForm);
    const fd = Object.fromEntries(formData.entries());

    const res = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(fd),
    });

    if (res && res.token) {
      setToken(res.token, res.user);
      alert("Logged in");
      showSection("notes");
    } else {
      alert(res.message || "Login failed");
    }
  });
}

// ---------- PROFILE ----------
async function loadProfile() {
  if (!state.token) {
    showSection("login");
    return;
  }
  const res = await api("/api/profile");
  if (!res || !res.user) return;

  const info = document.getElementById("profileInfo");
  if (info) {
    info.innerHTML = `<p><strong>${res.user.name}</strong><br>${res.user.email}<br>${res.user.college || ""}</p>`;
  }

  const f = document.getElementById("profileForm");
  if (f) {
    f.name.value = res.user.name || "";
    f.college.value = res.user.college || "";
    f.profile_pic.value = res.user.profile_pic || "";
  }

  const avatar = document.getElementById("profileAvatar");
  if (avatar) {
    avatar.src =
      res.user.profile_pic || "https://via.placeholder.com/72?text=User";
  }
}

const profileForm = document.getElementById("profileForm");
if (profileForm) {
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(profileForm).entries());
    const res = await api("/api/profile", {
      method: "POST",
      body: JSON.stringify(fd),
    });
    if (res.ok) {
      alert("Profile saved");
      loadProfile();
    } else {
      alert(res.message || "Error saving profile");
    }
  });
}

const profilePicForm = document.getElementById("profilePicForm");
if (profilePicForm) {
  profilePicForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.token) {
      alert("Login required");
      return;
    }
    const fileInput = document.getElementById("profilePicFile");
    if (!fileInput || !fileInput.files[0]) {
      alert("Choose an image");
      return;
    }
    const form = new FormData();
    form.append("profile_pic", fileInput.files[0]);
    const res = await api("/api/profile/picture", {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      alert("Profile picture updated");
      const avatar = document.getElementById("profileAvatar");
      if (avatar) avatar.src = res.profile_pic;
    } else {
      alert(res.message || "Error uploading picture");
    }
  });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    setToken(null, null);
    alert("Logged out");
    showSection("login");
  });
}

// ---------- NOTES ----------
const uploadNoteForm = document.getElementById("uploadNoteForm");
if (uploadNoteForm) {
  uploadNoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.token) {
      alert("Please login");
      showSection("login");
      return;
    }
    const form = new FormData(uploadNoteForm);
    const res = await api("/api/notes", {
      method: "POST",
      body: form,
    });
    if (res.id) {
      alert("Note uploaded");
      uploadNoteForm.reset();
      loadNotes();
    } else {
      alert(res.message || "Upload failed");
    }
  });
}

async function loadNotes() {
  const ul = document.getElementById("notesList");
  if (!ul) return;

  if (state.showingBookmarks) {
    if (!state.token) {
      alert("Login required");
      showSection("login");
      return;
    }
    const data = await api("/api/notes-bookmarked");
    renderNotes(data || []);
  } else {
    const q = document.getElementById("notesQuery")
      ? document.getElementById("notesQuery").value
      : "";
    const course = document.getElementById("notesCourse")
      ? document.getElementById("notesCourse").value
      : "";
    const params = new URLSearchParams({ q, course });
    const data = await fetch("/api/notes?" + params.toString()).then((r) =>
      r.json()
    );
    renderNotes(data || []);
  }
}

function renderNotes(data) {
  const ul = document.getElementById("notesList");
  if (!ul) return;
  ul.innerHTML = "";

  data.forEach((n) => {
    const li = document.createElement("li");
    const rating = (n.avg_rating || 0).toFixed(1);
    const count = n.rating_count || 0;
    const fileLink = n.filename
      ? `<a href="${n.filename}" target="_blank">Download</a>`
      : "";
    li.innerHTML = `
      <strong>${n.title}</strong> <small>— ${n.course || ""}</small>
      <p>${n.description || ""}</p>
      <div class="note-meta">
        <span class="badge">⭐ ${rating} (${count})</span>
        ${n.tags ? `<span class="badge">${n.tags}</span>` : ""}
        <span class="small">By: ${n.author || "Unknown"}</span>
      </div>
      <div class="note-actions">
        ${fileLink}
        <button class="btn-rate" data-note-id="${n.id}">Rate</button>
        <button class="btn-bookmark" data-note-id="${n.id}">★ Bookmark</button>
        <button class="btn-comment" data-note-id="${n.id}">Comment</button>
        <button class="btn-view-comments" data-note-id="${n.id}">View Comments</button>
      </div>
      <div class="small" id="comments-${n.id}"></div>
    `;
    ul.appendChild(li);
  });
}

const notesSearch = document.getElementById("notesSearch");
if (notesSearch) {
  notesSearch.addEventListener("click", () => {
    state.showingBookmarks = false;
    loadNotes();
  });
}

const notesBookmarks = document.getElementById("notesBookmarks");
if (notesBookmarks) {
  notesBookmarks.addEventListener("click", () => {
    state.showingBookmarks = true;
    loadNotes();
  });
}

// Note buttons (rate / bookmark / comment / view comments)
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-rate")) {
    if (!state.token) {
      alert("Login required");
      return;
    }
    const id = e.target.dataset.noteId;
    const rating = parseInt(
      prompt("Rate this note (1-5):") || "0",
      10
    );
    if (!rating || rating < 1 || rating > 5) {
      alert("Invalid rating");
      return;
    }
    const res = await api(`/api/notes/${id}/rating`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    });
    if (res.ok) {
      alert("Thanks for rating");
      loadNotes();
    } else {
      alert(res.message || "Error");
    }
  }

  if (e.target.classList.contains("btn-bookmark")) {
    if (!state.token) {
      alert("Login required");
      return;
    }
    const id = e.target.dataset.noteId;
    const res = await api(`/api/notes/${id}/bookmark`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (res.bookmarked) alert("Note bookmarked");
    else alert("Bookmark removed");
  }

  if (e.target.classList.contains("btn-comment")) {
    if (!state.token) {
      alert("Login required");
      return;
    }
    const id = e.target.dataset.noteId;
    const text = prompt("Add your comment:");
    if (!text) return;
    const res = await api(`/api/notes/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ comment: text }),
    });
    if (res.id) alert("Comment added");
    else alert(res.message || "Error");
  }

  if (e.target.classList.contains("btn-view-comments")) {
    const id = e.target.dataset.noteId;
    const box = document.getElementById(`comments-${id}`);
    if (!box) return;
    const comments = await fetch(
      `/api/notes/${id}/comments`
    ).then((r) => r.json());
    box.innerHTML =
      comments
        .map(
          (c) =>
            `<div>• <strong>${c.author || "User"}:</strong> ${
              c.comment
            }</div>`
        )
        .join("") || "<em>No comments yet</em>";
  }
});

// ---------- MARKETPLACE ----------
const listItemForm = document.getElementById("listItemForm");
if (listItemForm) {
  listItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.token) {
      alert("Please login");
      showSection("login");
      return;
    }
    const form = new FormData(listItemForm);
    const res = await api("/api/items", {
      method: "POST",
      body: form,
    });
    if (res.id) {
      alert("Item listed");
      listItemForm.reset();
      loadItems();
    } else {
      alert(res.message || "Error listing item");
    }
  });
}

async function loadItems() {
  const ul = document.getElementById("itemsList");
  if (!ul) return;
  const q = document.getElementById("itemsQuery")
    ? document.getElementById("itemsQuery").value
    : "";
  const params = new URLSearchParams({ q });
  const data = await fetch("/api/items?" + params.toString()).then((r) =>
    r.json()
  );
  ul.innerHTML = "";
  (data || []).forEach((i) => {
    const li = document.createElement("li");
    const img = i.image_url
      ? `<img src="${i.image_url}" class="item-img" />`
      : "";
    li.innerHTML = `<strong>${i.name}</strong> — ₹${
      i.price || "0"
    }<p>${i.description || ""}</p>${img}<p class="small">Seller: ${
      i.seller || i.contact_email
    }</p>`;
    ul.appendChild(li);
  });
}

const itemsSearch = document.getElementById("itemsSearch");
if (itemsSearch) {
  itemsSearch.addEventListener("click", loadItems);
}

// ---------- LOST & FOUND ----------
const lfForm = document.getElementById("lfForm");
if (lfForm) {
  lfForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.token) {
      alert("Please login");
      showSection("login");
      return;
    }
    const fd = Object.fromEntries(new FormData(lfForm).entries());
    const res = await api("/api/lostfound", {
      method: "POST",
      body: JSON.stringify(fd),
    });
    if (res.id) {
      alert("Reported");
      lfForm.reset();
      loadLF();
    } else {
      alert(res.message || "Error");
    }
  });
}

async function loadLF() {
  const ul = document.getElementById("lfList");
  if (!ul) return;
  const data = await fetch("/api/lostfound").then((r) => r.json());
  ul.innerHTML = "";
  (data || []).forEach((l) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${l.type}</strong> — ${
      l.description
    }<p class="small">Location: ${l.location} • Reporter: ${
      l.reporter
    }</p>`;
    ul.appendChild(li);
  });
}

// ---------- ADMIN ----------
const loadStatsBtn = document.getElementById("loadStatsBtn");
if (loadStatsBtn) {
  loadStatsBtn.addEventListener("click", async () => {
    if (!state.token) {
      alert("Login as admin first");
      return;
    }
    const res = await api("/api/admin/stats");
    if (res.users !== undefined) {
      document.getElementById("adminStats").textContent = JSON.stringify(
        res,
        null,
        2
      );
    } else {
      alert(res.message || "Not admin / error");
    }
  });
}

// ---------- INITIAL LOAD ----------
if (state.token) showSection("notes");
else showSection("signup");
updateNavAuthUI();
