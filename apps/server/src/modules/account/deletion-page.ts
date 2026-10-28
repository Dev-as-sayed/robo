export const deletionPageHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Delete your Robo account</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111f;
        --surface: #101d2e;
        --raised: #16263b;
        --border: #22344a;
        --text: #f5f7fa;
        --muted: #93a4b8;
        --accent: #7ce3b1;
        --accent-ink: #042116;
        --danger: #ff7a7a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 12% 0%, rgba(124, 227, 177, 0.13), transparent 32rem),
          var(--bg);
        color: var(--text);
        font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .shell {
        width: min(960px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 2.5rem 0 4rem;
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 3rem;
      }
      .brand {
        color: var(--accent);
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.28em;
      }
      .tag {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        max-width: 18ch;
        margin: 0 0 1rem;
        font-size: clamp(2.2rem, 7vw, 4.2rem);
        line-height: 0.98;
        letter-spacing: -0.045em;
      }
      .lead {
        max-width: 62ch;
        margin: 0 0 2.5rem;
        color: var(--muted);
        font-size: 1.05rem;
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        gap: 1.25rem;
        align-items: start;
      }
      .card {
        display: grid;
        gap: 1rem;
        padding: 1.5rem;
        border: 1px solid var(--border);
        border-radius: 1.25rem;
        background: var(--surface);
      }
      .card.accent {
        border-color: rgba(124, 227, 177, 0.3);
        background: rgba(124, 227, 177, 0.06);
      }
      h2 {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      p { margin: 0; }
      .muted { color: var(--muted); }
      label {
        display: grid;
        gap: 0.4rem;
        color: var(--text);
        font-size: 0.85rem;
        font-weight: 700;
      }
      input, textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        background: var(--raised);
        color: var(--text);
        font: inherit;
        padding: 0.85rem 0.95rem;
      }
      input:focus, textarea:focus {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      textarea { min-height: 6rem; resize: vertical; }
      .check {
        display: flex;
        grid-template-columns: none;
        align-items: flex-start;
        gap: 0.7rem;
        color: var(--muted);
        font-weight: 500;
      }
      .check input {
        width: 1.15rem;
        height: 1.15rem;
        margin-top: 0.15rem;
        accent-color: var(--accent);
        flex: 0 0 auto;
      }
      button {
        min-height: 3.35rem;
        border: 0;
        border-radius: 0.85rem;
        background: var(--accent);
        color: var(--accent-ink);
        cursor: pointer;
        font: inherit;
        font-weight: 800;
      }
      button:disabled { cursor: wait; opacity: 0.6; }
      .status {
        min-height: 1.5rem;
        color: var(--muted);
        font-size: 0.9rem;
      }
      .status[data-state="success"] { color: var(--accent); }
      .status[data-state="error"] { color: var(--danger); }
      ol, ul { margin: 0; padding-left: 1.2rem; color: var(--muted); }
      li + li { margin-top: 0.55rem; }
      .aside-section { display: grid; gap: 0.55rem; }
      footer {
        margin-top: 2.5rem;
        color: var(--muted);
        font-size: 0.82rem;
      }
      a { color: var(--accent); }
      @media (max-width: 760px) {
        .grid { grid-template-columns: 1fr; }
        .top { margin-bottom: 2rem; }
      }
    </style>
    <script src="/account/delete.js" defer></script>
  </head>
  <body>
    <main class="shell">
      <div class="top">
        <span class="brand">ROBO</span>
        <span class="tag">Account deletion</span>
      </div>

      <h1>Delete your Robo account.</h1>
      <p class="lead">
        Use this page if you no longer have the app or cannot sign in. We will
        verify that you own the account before deleting it and its data.
      </p>

      <div class="grid">
        <section class="card accent" aria-labelledby="request-title">
          <h2 id="request-title">Request deletion</h2>
          <form id="deletion-form">
            <label for="email">
              Account email
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                required
              />
            </label>
            <label for="reason">
              Reason (optional)
              <textarea
                id="reason"
                name="reason"
                maxlength="500"
                placeholder="Tell us why you are leaving, if you want to."
              ></textarea>
            </label>
            <label class="check" for="confirm">
              <input id="confirm" name="confirm" type="checkbox" required />
              <span>
                I understand that deleting my account is permanent and removes
                my data as described on this page.
              </span>
            </label>
            <button id="submit" type="submit">Request account deletion</button>
            <p id="status" class="status" role="status" aria-live="polite"></p>
          </form>
        </section>

        <aside class="card">
          <div class="aside-section">
            <h2>What happens next</h2>
            <ol>
              <li>We check whether the email matches an account.</li>
              <li>We contact you at that address to verify ownership.</li>
              <li>After verification, we delete the account and associated data.</li>
            </ol>
          </div>
          <div class="aside-section">
            <h2>Faster option</h2>
            <p class="muted">
              If you can still sign in, open the Robo app and go to
              <strong>Settings → Danger Zone → Delete my account</strong>. That
              deletes immediately without waiting for verification.
            </p>
          </div>
          <div class="aside-section">
            <h2>What is deleted</h2>
            <ul>
              <li>Your profile, devices and sign-in sessions</li>
              <li>Chats, AI feedback reports and memories</li>
              <li>Tasks, reminders, schedule, exams and study history</li>
              <li>Documents, uploaded files and document vectors</li>
              <li>Contacts, consents and other account-linked records</li>
            </ul>
          </div>
          <div class="aside-section">
            <h2>Privacy</h2>
            <p class="muted">
              We only use the email and reason to handle this request. Never
              send your password, API keys or document contents through this
              form.
            </p>
          </div>
        </aside>
      </div>

      <footer>
        If you do not receive a verification message, use the support contact
        listed on the Robo app store page.
      </footer>
    </main>
  </body>
</html>
`;

export const deletionPageScript = `(() => {
  const form = document.getElementById("deletion-form");
  const status = document.getElementById("status");
  const submit = document.getElementById("submit");

  if (!form || !status || !submit) {
    return;
  }

  const setStatus = (message, state) => {
    status.textContent = message;
    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const reason = String(data.get("reason") || "").trim();

    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    setStatus("Sending your request...");

    try {
      const response = await fetch("/api/v1/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          reason: reason || undefined,
          confirm: true,
        }),
      });

      if (response.status === 429) {
        setStatus("Too many requests. Wait a few minutes and try again.", "error");
        return;
      }

      if (!response.ok) {
        setStatus("We could not accept the request. Check the email and try again.", "error");
        return;
      }

      form.reset();
      setStatus(
        "Request received. If the email matches an account, we will contact you to verify ownership before deleting it.",
        "success"
      );
    } catch {
      setStatus("Network error. Check your connection and try again.", "error");
    } finally {
      submit.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
})();
`;
