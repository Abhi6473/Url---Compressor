const form = document.getElementById("shorten-form");
const input = document.getElementById("url-input");
const button = document.getElementById("shorten-btn");
const formError = document.getElementById("form-error");

const result = document.getElementById("result");
const shortUrlLink = document.getElementById("short-url");
const copyBtn = document.getElementById("copy-btn");

const historySection = document.getElementById("history-section");
const historyList = document.getElementById("history-list");

// Kept in memory only for this page load — no localStorage, per artifact rules.
const recentLinks = [];

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

function showError(message) {
  formError.textContent = message;
  formError.classList.remove("hidden");
}

function clearError() {
  formError.textContent = "";
  formError.classList.add("hidden");
}

function renderHistory() {
  if (recentLinks.length === 0) {
    historySection.classList.add("hidden");
    return;
  }
  historySection.classList.remove("hidden");
  historyList.innerHTML = "";
  // Most recent first.
  for (const item of [...recentLinks].reverse()) {
    const li = document.createElement("li");

    const shortAnchor = document.createElement("a");
    shortAnchor.href = item.shortUrl;
    shortAnchor.target = "_blank";
    shortAnchor.rel = "noopener";
    shortAnchor.textContent = item.shortUrl.replace(/^https?:\/\//, "");

    const original = document.createElement("span");
    original.className = "history-original";
    original.textContent = item.originalUrl;
    original.title = item.originalUrl;

    li.appendChild(shortAnchor);
    li.appendChild(original);
    historyList.appendChild(li);
  }
}

async function shortenUrl(url) {
  const response = await fetch(`/shorten?url=${encodeURIComponent(url)}`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Unexpected response from server.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // stop the page from reloading on submit
  clearError();

  const url = input.value.trim();
  if (!url) {
    showError("Please enter a URL.");
    return;
  }

  setLoading(true);
  try {
    const data = await shortenUrl(url);

    result.classList.remove("hidden");
    shortUrlLink.textContent = data.shortUrl;
    shortUrlLink.href = data.shortUrl;

    recentLinks.push(data);
    renderHistory();

    input.value = "";
    input.focus();
  } catch (err) {
    showError(err.message || "Failed to shorten URL. Please try again.");
  } finally {
    setLoading(false);
  }
});

copyBtn.addEventListener("click", async () => {
  const text = shortUrlLink.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    copyBtn.disabled = true;
    setTimeout(() => {
      copyBtn.textContent = original;
      copyBtn.disabled = false;
    }, 1500);
  } catch {
    // Clipboard API can fail (e.g. permissions); fall back silently.
    showError("Couldn't copy automatically — please copy the link manually.");
  }
});

// Clear the inline error as soon as the user starts fixing their input.
input.addEventListener("input", clearError);
