# URL Shortener

A simple URL shortener with a C++ backend, a thin Node.js/Express layer in
front of it, and a plain HTML/CSS/JS frontend. Paste in a long URL, get
back a short one, and visiting the short one redirects you to the original.

## How it works

```
Browser (HTML/CSS/JS)
        │
        │  fetch("/shorten?url=...")
        ▼
Node.js + Express server (server.js)
        │
        │  spawns the C++ program as a subprocess,
        │  passing the URL / short code as an argument
        ▼
C++ URL shortener (backend/main.cpp)
        │
        ▼
data.txt   (stores id <-> URL pairs)
```

- The **frontend** is a static page that calls two endpoints: one to
  shorten a URL, one to follow a short link.
- The **Express server** doesn't contain any shortening logic itself —
  it just validates input, runs the compiled C++ program, and passes the
  result back as JSON (or as an HTTP redirect).
- The **C++ program** does the actual work: it assigns each new URL the
  next available numeric ID, encodes that ID into a short base62 code
  (`0-9A-Za-z`), and appends `id|url` to `data.txt`. To resolve a short
  code, it decodes it back into an ID and looks up the matching URL.
- `data.txt` lives next to the compiled executable and is the only
  "database" — there's no external database involved.

### Endpoints

| Method | Path           | Description                                      |
|--------|----------------|---------------------------------------------------|
| GET    | `/`            | Serves the frontend                               |
| GET    | `/shorten?url=`| Shortens a URL, returns `{ shortUrl, code, originalUrl }` |
| GET    | `/r/:code`     | Redirects to the original URL for that short code  |

## Project structure

```
url-shortener/
├── backend/
│   └── main.cpp        # C++ shortening/redirect logic
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── server.js            # Express server, glues frontend <-> C++ backend
├── package.json
└── Readme.md
```

## Requirements

- **Node.js** (v18 or newer recommended)
- **A C++ compiler** supporting C++17, e.g. **g++** (MinGW on Windows,
  build-essential on Linux, Xcode command line tools on macOS). Any g++
  from roughly the last decade works — no need for the newest version.

## Getting it from GitHub

Clone the repository and move into it:

```bash
git clone https://github.com/<your-username>/url-shortener.git
cd url-shortener
```

(Replace `<your-username>` with wherever you've hosted this repo.)

## Running it locally

### 1. Install Node dependencies

```bash
npm install
```

### 2. Compile the C++ backend

The repo ships only the C++ **source** (`backend/main.cpp`), not a
prebuilt binary — compiling it yourself guarantees it matches your OS.

**Windows (MinGW/g++):**
```bash
cd backend
g++ -O2 -o main.exe main.cpp -std=c++17
cd ..
```

**Linux / macOS:**
```bash
g++ -O2 -o backend/main backend/main.cpp -std=c++17
```

`server.js` automatically looks for `backend/main.exe` first, then
`backend/main`, and uses whichever one exists — so you only need to
build for the platform you're actually running on.

### 3. Start the server

```bash
node server.js
```

You should see:

```
Server is running on http://localhost:3000
Using backend executable: <path to your compiled binary>
```

Open **http://localhost:3000** in your browser.

### Using the backend directly (optional)

The C++ program can also be run on its own from the command line:

```bash
./backend/main shorten "https://example.com/some/long/path"
./backend/main redirect <code>
```

## Deploying it as a live website

This app needs an actual running server process (Node + the compiled
C++ binary) — it is **not** a static site, so it can't be hosted on
something like GitHub Pages, which only serves static files. You need a
host that can run `node server.js` continuously. Render, Railway, and
Fly.io all offer free or low-cost tiers and deploy straight from a
GitHub repo.

The steps below use **Render** as an example; Railway and Fly.io are
nearly identical (pick a repo, set a build command and a start command,
deploy).

### 1. Push this project to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<your-username>/url-shortener.git
git branch -M main
git push -u origin main
```

Add a `.gitignore` first so you don't commit build artifacts:

```
node_modules/
backend/data.txt
backend/main
backend/main.exe
```

### 2. Add a build script

Most hosts run a "build command" before starting the app. Since the C++
binary isn't committed to the repo, the host needs to compile it as part
of deployment. Create `build.sh` in the project root:

```bash
#!/bin/bash
set -e
npm install
g++ -O2 -o backend/main backend/main.cpp -std=c++17
```

Make it executable:

```bash
chmod +x build.sh
```

### 3. Deploy on Render

1. Go to [render.com](https://render.com) and sign in with GitHub.
2. **New → Web Service**, then select your repository.
3. Configure:
   - **Build Command:** `./build.sh`
   - **Start Command:** `node server.js`
   - **Environment:** Node
4. Click **Deploy**.

Render assigns the port via the `PORT` environment variable, which
`server.js` already reads (`process.env.PORT || 3000`), so no changes
are needed there.

You'll get a public URL like `https://your-app.onrender.com` once the
build finishes.

### A limitation worth knowing

`data.txt` is stored on the server's local disk. On most free hosting
tiers, that disk **isn't persistent** — it can be wiped on redeploys or
restarts, which means previously shortened links could stop working
after that happens. This is fine for a demo or portfolio piece. For
links that need to survive long-term, the underlying file-based storage
would need to be replaced with a real database (e.g. SQLite on a
persistent disk, or Postgres) — happy to help with that separately if
you want to take it further.

## Notes

- `data.txt` is created automatically the first time you shorten a URL —
  you don't need to create it yourself.
- Short codes are base62 (`0-9`, `A-Z`, `a-z`), so they stay compact even
  as the number of stored URLs grows.
- Shortening the same URL twice returns the same short code rather than
  creating a duplicate entry.
