const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Pick whichever backend binary actually exists on this machine.
// Windows builds ship as main.exe, Linux/Mac builds as main (no extension).
const exeCandidates = ["main.exe", "main"];
const backendExe = exeCandidates
    .map((name) => path.join(__dirname, "backend", name))
    .find((fullPath) => fs.existsSync(fullPath));

if (!backendExe) {
    console.error(
        "No backend executable found in /backend (expected main.exe or main).\n" +
        "Compile it first, e.g.: g++ -O2 -o backend/main backend/main.cpp -std=c++17"
    );
    process.exit(1);
}

// Zipping/unzipping (and some file transfers) can strip the execute bit on
// Linux/Mac. Re-apply it defensively so a freshly-extracted copy still runs
// without the user having to remember `chmod +x`.
if (process.platform !== "win32") {
    try {
        fs.chmodSync(backendExe, 0o755);
    } catch (err) {
        console.warn(`Could not set execute permission on ${backendExe}:`, err.message);
    }
}

app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Runs the C++ backend safely: execFile passes arguments directly to the
// binary instead of through a shell, so a URL containing quotes, $(), `, etc.
// can't break out and run arbitrary commands.
function runBackend(args, callback) {
    execFile(backendExe, args, { timeout: 5000 }, (error, stdout, stderr) => {
        callback(error, stdout ? stdout.trim() : "", stderr);
    });
}

app.get("/shorten", (req, res) => {
    const url = req.query.url;

    if (!url || url.trim() === "") {
        return res.status(400).json({ error: "URL parameter is required" });
    }

    // Basic sanity check so we don't hand obviously-bad input to the backend.
    let parsed;
    try {
        parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Unsupported protocol");
        }
    } catch {
        return res.status(400).json({ error: "Please enter a valid http:// or https:// URL" });
    }

    runBackend(["shorten", url], (error, code) => {
        if (error) {
            console.error("shorten error:", error.message);
            return res.status(500).json({ error: "Failed to shorten URL" });
        }
        if (!code) {
            return res.status(500).json({ error: "Backend returned no result" });
        }
        const shortUrl = `${req.protocol}://${req.get("host")}/r/${code}`;
        res.json({ shortUrl, code, originalUrl: url });
    });
});

app.get("/r/:code", (req, res) => {
    const { code } = req.params;

    runBackend(["redirect", code], (error, originalUrl) => {
        if (error) {
            console.error("redirect error:", error.message);
            return res.status(500).send("Something went wrong looking up that link.");
        }
        if (!originalUrl) {
            return res.status(404).send("Short link not found.");
        }
        res.redirect(originalUrl);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Using backend executable: ${backendExe}`);
});
