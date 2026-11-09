# coloGAMA — Tailwind Redesign Plan

To be hand-applied and reviewed by the user — no direct edits to `frontend/` were made by Claude.

**Revision note**: original Phase 2 mistakenly merged `main_dashboard.html` straight into `Hero.jsx`, skipping `home.html` entirely. Corrected below — `home.html` (marketing landing) and `main_dashboard.html` (functional capture screen) are now two separate pages/components, per user's Phase 1 follow-up decision. If you already built the *old* Phase 2 (dashboard content directly in `Hero.jsx`), see the "Migrating from the old Phase 2" note before Phase 2 below.

## Context

coloGAMA's frontend currently has three unrelated, undocumented color schemes fighting each other (`Navbar` near-black `#202020`, `Hero` navy `#08003a`, `History` purple gradient `#667eea`/`#764ba2`), inconsistent border-radius (5px through 50%, six+ different values), zero shared design tokens, and no Tailwind (100% hand-written per-component CSS). Meanwhile `docs/plan/design/` contains four polished Tailwind-based HTML mockups (`home.html`, `main_dashboard.html`, `capture_history`, `analysis_results`) plus `design_sys.md` defining a cohesive "Scientific Precision" violet/lavender identity, built for exactly this app.

Decisions made:
1. **Adopt Tailwind CSS v4** — its config-enforced token system directly targets the app's actual failure mode (color/spacing drift), not just an aesthetic preference. v4 setup uses the `@tailwindcss/vite` plugin + a CSS-native `@theme` block, not the older `tailwind.config.js`/PostCSS approach.
2. **Full structural redesign** — adopt the mockups' layout patterns rather than just a color reskin. Chosen specifically because the current top-`Navbar` doesn't handle the Pi's small/touch screen context well, and the mockups already solve this correctly.
3. **Adopt Material Symbols Outlined** icon font, replacing plain text/emoji icons.
4. **Two separate pages, two separate nav systems** (this revision): `home.html` → landing page at `/`, with its own distinct dark scroll-aware top nav, standalone (not wrapped in the app's persistent sidebar shell). `main_dashboard.html` → the actual functional capture page at `/dashboard`, wrapped in the persistent `SideNav` shell along with `/results` and `/history`. The landing page's "START CAPTURE" button navigates to `/dashboard`; the real `triggerCapture()` call and pulse button live on the dashboard page, not the landing page.

**Non-negotiable UX fix, regardless of the above**: `History.jsx`'s current action buttons are hidden until row `:hover` (`group-hover:opacity-100`) — hover doesn't exist on touchscreens, this is a real correctness bug for a Pi touchscreen context. Every redesigned interactive element must also hit the 44×44px minimum touch target `design_sys.md` calls for.

**What does NOT change**: all existing business logic — `triggerCapture()`/`getHistory()` from `frontend/src/service/api.js`, Chart.js histogram data wiring, PDF.js viewer logic in `History.jsx`, capture-selector state in `Results.jsx`. This is a presentation-layer migration onto existing data flow, not a logic rewrite — `triggerCapture()`'s call site just moves from `Hero.jsx` to the new `Dashboard.jsx`.

---

## Token reconciliation (mockups vs. `design_sys.md`)

All three mockup files (`home.html`, `main_dashboard.html`, and the earlier-reviewed `capture_history`/`analysis_results`) implement a much larger, more complete Material3-style token set than `design_sys.md` documents — `design_sys.md` says primary `#7C3AED` / background pure white; the mockups actually implement `primary #630ed4` with `primary-container #7c3aed`, a lilac-white `#fef7ff` surface (not pure white), plus dozens of additional `on-*`/`*-container`/`*-fixed` tokens for hover/pressed/disabled states. **Use the mockups' actual implemented values as the source of truth.** The `@theme` block in Phase 0 below already covers every token actually *used* across all four mockups' visible markup (cross-checked against `home.html` and `main_dashboard.html` specifically for this revision) — the full ~60-token set in the mockups includes many unused-in-practice Material3 scaffolding tokens (e.g. `on-tertiary-fixed-variant`) not worth porting.

---

## Phase 0 — Install & configure Tailwind (v4 — Vite plugin, no PostCSS/config file)

*(Unchanged from original plan — already completed if you've done Phase 0.)*

```bash
cd ~/coloGAMA/frontend
npm install -D tailwindcss @tailwindcss/vite
```

If `postcss.config.js` or `tailwind.config.js` got created by an earlier failed/partial run, delete them — v4 with the Vite plugin needs neither:
```bash
rm -f postcss.config.js tailwind.config.js
```
`autoprefixer`/`postcss` aren't needed either — v4 handles vendor prefixing internally. Clean up with `npm uninstall autoprefixer postcss` if desired.

**`vite.config.js`**:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**`index.html`** — replace the Ubuntu font with Inter, add Material Symbols:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
```

**`src/index.css`** — replace entirely:
```css
@import "tailwindcss";

@theme {
  --color-primary: #630ed4;
  --color-primary-container: #7c3aed;
  --color-on-primary-container: #ede0ff;
  --color-secondary: #DDD6FE;
  --color-surface: #fef7ff;
  --color-surface-dim: #F8F9FF;
  --color-surface-container: #f3ebfa;
  --color-surface-container-low: #f9f1ff;
  --color-on-surface: #1d1a24;
  --color-on-surface-variant: #4a4455;
  --color-chart-red: #EF4444;
  --color-chart-green: #22C55E;
  --color-chart-blue: #3B82F6;
  --color-success: #10B981;
  --color-success-bg: #dcfce7;
  --color-success-text: #166534;
  --color-warning: #F59E0B;
  --color-error: #ba1a1a;
  --color-slate-heading: #1E293B;
  --color-slate-body: #64748B;
  --color-secondary-fixed-dim: #c5c6cc;
  --color-outline-variant: #ccc3d8;
  --color-border: #E2E8F0;
  --color-pure-white: #FFFFFF;

  --font-sans: "Inter", sans-serif;

  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  --spacing-gutter: 24px;
  --spacing-margin-mobile: 16px;
  --spacing-margin-desktop: 40px;

  --container-container: 1280px;
}

@layer base {
  body {
    @apply bg-surface text-on-surface font-sans;
  }
}

@layer utilities {
  .material-symbols-outlined {
    font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
  }

  @keyframes pulse-ring {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.5); }
    70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(124, 58, 237, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
  }
  .pulse-ring {
    animation: pulse-ring 2s infinite;
  }

  /* home.html's hero background treatment */
  .hero-gradient {
    background: linear-gradient(180deg, rgba(15, 10, 25, 0.8) 0%, rgba(15, 10, 25, 0.95) 100%);
  }
}
```
*(Added `on-primary-container`, `surface-container`/`surface-container-low`, `on-surface-variant`, `success-bg`/`success-text`, `secondary-fixed-dim`, `outline-variant`, `pure-white`, and `.hero-gradient` vs. the original Phase 0 — these are used by `home.html`/`main_dashboard.html` and weren't in the first pass, which only covered `capture_history`/`analysis_results`.)*

**Note on `--container-container`**: if `max-w-container` doesn't generate as expected, use `max-w-[1280px]` (arbitrary value) instead — flag this when testing.

Delete the old Ubuntu `@import`, global reset, `.container`, `.btn-utama` rules from the previous `index.css`.

---

## Phase 1 — Layout shell (revised: two nav systems, nested routes)

*(If you already did the original Phase 1 — `SideNav.jsx` + the flat `App.jsx` shell — that work stays, but `App.jsx` needs restructuring below to add a route that skips the shell.)*

**`SideNav.jsx`** — unchanged from original Phase 1, except the "Capture" nav item's target moves from `/` to `/dashboard`:
```jsx
const navItems = [
  { to: "/dashboard", icon: "photo_camera", label: "Capture" },
  { to: "/results", icon: "analytics", label: "Results" },
  { to: "/history", icon: "history", label: "History" },
];
```
Remove the `end={item.to === "/"}` special-casing on both `<NavLink>`s (both instances in the file) — no longer needed since `/` isn't one of `SideNav`'s own routes anymore.

**New file `src/Components/TopNav/TopNav.jsx`** — `home.html`'s distinct dark, scroll-aware nav, used only on the landing page:
```jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const TopNav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 h-20 flex items-center ${
        scrolled ? "bg-[#0A0514]/90 backdrop-blur-md shadow-sm border-b border-white/10" : ""
      }`}
    >
      <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop w-full flex justify-between items-center">
        <Link to="/" className="text-2xl text-pure-white tracking-tight flex items-center gap-2">
          <span className="text-secondary">colo</span>GAMA
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/dashboard" className="text-sm font-semibold text-pure-white hover:text-secondary transition-colors">
            Capture
          </Link>
          <Link to="/results" className="text-sm font-semibold text-secondary-fixed-dim hover:text-pure-white transition-colors">
            Results
          </Link>
          <Link to="/history" className="text-sm font-semibold text-secondary-fixed-dim hover:text-pure-white transition-colors">
            History
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
```
This reimplements `home.html`'s inline `<script>` scroll listener (nav background/blur/shadow toggling past 50px scroll) as a React `useEffect` + state — same behavior, React-idiomatic instead of raw DOM class manipulation.

**`src/App.jsx`** — nested layout routes so `/` renders standalone (its own nav+footer inside `Hero.jsx`), while `/dashboard`, `/results`, `/history` share the `SideNav` shell:
```jsx
import SideNav from './Components/SideNav/SideNav'
import Hero from './Components/Hero/Hero'
import Dashboard from './Components/Dashboard/Dashboard'
import Footer from './Components/Footer/Footer'
import History from './Components/NavBar/History/History'
import Results from './Components/Results/Results'
import { BrowserRouter as Router, Route, Routes, Outlet } from 'react-router-dom';

const AppShell = () => (
  <div className="flex min-h-screen bg-surface">
    <SideNav />
    <div className="flex-1 flex flex-col pb-20 md:pb-0">
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  </div>
);

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/results" element={<Results />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
```
`<Route element={<AppShell />}>` wrapping child `<Route>`s is React Router's standard "layout route" pattern — `AppShell` renders `SideNav` + `Footer` once, and whichever child route matches renders into `<Outlet />` in between. `/` sits outside that wrapper entirely, so it gets neither `SideNav` nor the shell's `Footer` — `Hero.jsx` (Phase 2 below) provides its own `TopNav` and `Footer` internally instead.

---

## Phase 2 — Landing page (`Hero.jsx` → `home.html`)

**Migrating from the old Phase 2**: if `Hero.jsx` currently has the dashboard-style content (live feed placeholder, pulse button, `triggerCapture()` call) from the original plan's Phase 2, that entire block — markup *and* the `handleRunColometry`/`loading`/`error` logic — moves to the new `Dashboard.jsx` in Phase 3 below. `Hero.jsx` goes back to being a simple, mostly-static landing page with no API calls at all.

```jsx
import { Link } from 'react-router-dom';
import TopNav from '../TopNav/TopNav';
import Footer from '../Footer/Footer';
import heroImage from '../../assets/main1.jpg';

const Hero = () => {
  return (
    <div className="bg-surface">
      <TopNav />

      {/* Hero section */}
      <header className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden bg-[#0A0514]">
        <div className="absolute inset-0 z-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 hero-gradient" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto mt-20">
          <h1 className="text-5xl md:text-6xl font-bold text-pure-white mb-6 drop-shadow-lg">
            Explore Your Color
          </h1>
          <p className="text-lg text-secondary-fixed-dim max-w-2xl mx-auto mb-10 leading-relaxed">
            Advanced image processing system for precise RGB color-based chemical identification.
            Integrating hardware design and sophisticated software on a robust, portable architecture.
          </p>
          <Link
            to="/dashboard"
            className="bg-primary-container text-pure-white px-8 py-4 rounded-lg font-semibold flex items-center gap-3 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_14px_rgba(124,58,237,0.4)] min-h-11"
          >
            START CAPTURE
            <span className="material-symbols-outlined">arrow_outward</span>
          </Link>
        </div>
      </header>

      {/* Features section */}
      <section className="py-24 bg-surface relative z-20 -mt-10 rounded-t-[40px]">
        <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-heading mb-4">Laboratory-Grade Precision</h2>
            <p className="text-slate-body max-w-2xl mx-auto">
              Seamlessly transition from capture to complex analytical results with our high-contrast, data-focused dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {[
              { icon: "photo_camera", title: "High-Fidelity Capture", body: "Utilize optimized camera settings to capture uncompressed colorimetric data, ensuring the highest accuracy for chemical reaction analysis." },
              { icon: "analytics", title: "RGB Extraction", body: "Our proprietary algorithms isolate and extract precise Red, Green, and Blue values from your samples, plotting them instantly on interactive histograms." },
              { icon: "history", title: "Audit Trail", body: "Maintain a secure, searchable history of all analyses. Export detailed PDF reports outlining visual data, timestamps, and confidence metrics." },
            ].map((f) => (
              <div key={f.title} className="bg-pure-white rounded-xl p-8 shadow-[0px_4px_10px_rgba(0,0,0,0.05)] border border-border hover:shadow-[0px_10px_30px_rgba(124,58,237,0.1)] transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary">{f.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-on-surface mb-3">{f.title}</h3>
                <p className="text-slate-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Hero;
```
Reuses the existing `main1.jpg` asset already in `src/assets/` (same one the current `Hero.css` uses as its background image) instead of the mockup's remote placeholder image.

---

## Phase 3 — Dashboard page (new `Dashboard.jsx`, from `main_dashboard.html`)

New file **`src/Components/Dashboard/Dashboard.jsx`** — this is where `triggerCapture()`, `loading`, `error`, and the navigate-to-`/results`-on-success logic actually live now (moved from the old `Hero.jsx`):

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerCapture } from '../../service/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleRunColometry = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await triggerCapture();
      localStorage.setItem('latestCapture', JSON.stringify(data));
      navigate('/results', { state: { captureData: data } });
    } catch (err) {
      console.error("Error capturing image", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-margin-mobile md:p-margin-desktop flex flex-col items-center justify-center gap-gutter">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-gutter">
        {/* Camera Preview */}
        <div className="flex-1 bg-pure-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-4 border border-border flex flex-col relative aspect-[4/3] md:aspect-auto md:min-h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-heading">Live Feed</h2>
            <span className="bg-surface-container text-primary text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success inline-block" /> Live
            </span>
          </div>
          <div className="flex-1 bg-surface-dim rounded-lg overflow-hidden relative flex items-center justify-center border border-dashed border-outline-variant">
            <div className="z-10 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-2">linked_camera</span>
              <p className="text-on-surface-variant">Camera Feed Offline</p>
              <p className="text-sm text-slate-body mt-1">Connect device to begin</p>
            </div>
          </div>
        </div>

        {/* Controls & Status */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-pure-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-6 border border-border flex flex-col items-center text-center">
            <button
              onClick={handleRunColometry}
              disabled={loading}
              className="pulse-ring w-32 h-32 rounded-full bg-primary-container text-on-primary-container flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95 mb-4 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-4xl">photo_camera</span>
            </button>
            <h3 className="text-xl font-semibold text-slate-heading mb-1">
              {loading ? "Capturing..." : "START CAPTURE"}
            </h3>
            <p className="text-sm text-slate-body">Initiate colorimetric analysis</p>
            {error && (
              <p className="text-error bg-error/10 border border-error/30 rounded-lg px-4 py-2 text-sm mt-4">
                {error}
              </p>
            )}
          </div>

          {/* System Status — static/decorative, no backend endpoint provides this today */}
          <div className="bg-pure-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-6 border border-border flex-1">
            <h3 className="text-xs font-semibold text-slate-heading mb-4 uppercase tracking-wider">System Status</h3>
            <div className="flex flex-col gap-4">
              {[
                { icon: "developer_board", label: "Hardware", status: "Ready", color: "text-primary" },
                { icon: "lightbulb", label: "Lighting", status: "Optimized", color: "text-warning" },
                { icon: "wifi", label: "Connection", status: "Active", color: "text-chart-blue" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-surface-dim border border-border">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                    <span className="text-on-surface">{s.label}</span>
                  </div>
                  <span className="bg-success-bg text-success-text text-xs font-medium px-2 py-1 rounded-full">{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```

**Note on "System Status"**: the mockup's Hardware/Lighting/Connection panel is static decoration in `main_dashboard.html` (hardcoded "Ready"/"Optimized"/"Active"), and there's no backend endpoint today providing real hardware status — ported as-is (static). If real status wiring is wanted later (e.g. reflecting actual camera/LED/network state), that's new backend work, out of scope for this visual migration.

**Note on the camera preview**: kept as the mockup's static "Camera Feed Offline" placeholder — the backend has no live MJPEG/WebSocket video stream endpoint (readme's roadmap lists "Real-time video streaming" as a future item), so this stays a placeholder rather than an actual `<img>`/`<video>` feed, matching the mockup's own offline state exactly.

---

## Phase 4 — Results page (`Results.jsx`, from `analysis_results`)

*(Unchanged from original plan.)* Keep all existing state/`getChartData`/`chartOptions`/Chart.js `<Line>` wiring — restyle the wrapper markup:

```jsx
<div className="grid grid-cols-3 gap-4">
  {[
    { label: "Red", value: capture.rgb_values.R, color: "chart-red" },
    { label: "Green", value: capture.rgb_values.G, color: "chart-green" },
    { label: "Blue", value: capture.rgb_values.B, color: "chart-blue" },
  ].map((c) => (
    <div key={c.label} className={`bg-white border-t-4 border-${c.color} rounded-lg shadow-sm p-4`}>
      <p className="text-slate-body text-sm">{c.label} Channel</p>
      <p className="text-2xl font-bold text-slate-heading">{c.value}</p>
    </div>
  ))}
</div>

<div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
  {captureData.captures.map((capture, index) => (
    <button
      key={index}
      onClick={() => setSelectedCapture(index)}
      className={`shrink-0 w-16 h-16 rounded-lg border-2 flex items-center justify-center font-medium min-h-11 min-w-11 ${
        selectedCapture === index
          ? "border-primary-container bg-primary-container/10 text-primary-container"
          : "border-border text-slate-body"
      }`}
    >
      C{capture.capture_number}
    </button>
  ))}
</div>
```

> **Note on the `border-${c.color}` line**: Tailwind's scanner needs *complete* class strings at build time — dynamic interpolation like `border-${c.color}` will NOT generate. Use a static lookup:
> ```jsx
> const borderColorClass = { "chart-red": "border-chart-red", "chart-green": "border-chart-green", "chart-blue": "border-chart-blue" };
> ```
> Applies everywhere a color/variant is chosen dynamically — flag every instance during implementation.

---

## Phase 5 — History page (`History.jsx`, from `capture_history`)

*(Unchanged from original plan.)* Keep all existing `useEffect`/`getHistory()`/filter/modal/PDF.js logic — restyle table + **fix the touch bug**:

```jsx
<td className="flex gap-2 py-2">
  <button
    onClick={() => handleView(item)}
    className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-primary-container"
    aria-label="View"
  >
    <span className="material-symbols-outlined">visibility</span>
  </button>
  <button
    onClick={() => handleDownload(item)}
    className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-primary-container"
    aria-label="Download"
  >
    <span className="material-symbols-outlined">download</span>
  </button>
</td>
```
Buttons render at full opacity always — no `group-hover:opacity-100` gating. `hover:` classes only add a subtle background on pointer devices, never gate visibility/functionality.

```jsx
<div className="flex gap-2 flex-wrap">
  {["all", "pdf", "image", "histogram"].map((f) => (
    <button
      key={f}
      onClick={() => setSelectedFilter(f)}
      className={`px-4 py-2 rounded-full min-h-11 text-sm font-medium ${
        selectedFilter === f ? "bg-primary-container text-white" : "bg-surface-dim text-slate-body"
      }`}
    >
      {f === "all" ? `All Files (${historyData.length})` : f}
    </button>
  ))}
</div>
```

---

## Phase 6 — Cleanup

Once every page is confirmed working with the new Tailwind markup:
```bash
rm src/Components/Hero/Hero.css
rm src/Components/Results/Results.css
rm src/Components/NavBar/History/History.css
rm src/Components/NavBar/Navbar.css src/Components/NavBar/Navbar.jsx  # replaced by SideNav + TopNav
rm src/Components/Footer/Footer.css
```
Remove the corresponding `import "./X.css"` lines from each `.jsx` file first — Vite errors on a missing import otherwise.

---

## Verification checklist

- [ ] `npm run dev -- --host 0.0.0.0` — confirm `/` shows the landing page with **no** `SideNav` visible, and `/dashboard`/`/results`/`/history` all show `SideNav` (desktop) and share one persistent `Footer`
- [ ] Landing page's `TopNav` background/blur transitions correctly past 50px scroll
- [ ] Landing page's "START CAPTURE" navigates to `/dashboard` (no API call fires from `/`)
- [ ] Dashboard's pulse capture button actually triggers `triggerCapture()`, shows loading state, navigates to `/results` on success, shows inline error on failure (test with backend stopped, per the friendly-error work done earlier this session)
- [ ] Resize/DevTools-emulate at 480px, 800px, 1024px widths — confirm `SideNav` collapses to bottom nav below `md` (768px) on the shell-wrapped pages; confirm landing page's `TopNav` remains usable/readable at small widths too (its own responsive behavior, separate from `SideNav`'s)
- [ ] Every interactive element (nav items, capture button, filter chips, view/download icons) is at least 44×44px via DevTools box model inspection
- [ ] History's view/download icons are visible without hovering (touch-correctness fix) — verify by disabling `:hover` in DevTools or on an actual touchscreen/phone
- [ ] `npm run build` — no errors, check final CSS/JS bundle size in the build output
- [ ] Full real-device test: load on the Pi's own screen (if attached) and from a phone over the `cologama` hotspot, confirm both nav systems and touch targets look correct
- [ ] Deploy `dist/`, confirm nginx serves the updated build (hard-refresh already-open tabs)
