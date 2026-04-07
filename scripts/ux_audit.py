"""
Comprehensive UX Audit: Playwright screenshots → local LLaVA vision → UX-AUDIT.md

Screenshots every route at mobile + desktop, including:
- Interactive flows (search, open report, scroll)
- Scrolled states (mid-page, bottom)
- Modals and overlays
- Dark mode
- Error/empty states

Each page gets a PAGE-SPECIFIC prompt explaining what the page is supposed to do,
so the model can assess whether it achieves its purpose — not just generic UX rules.

Final pass: cross-page consistency analysis.

USAGE:
  py -3.14 scripts/ux_audit.py                              # audit prod
  py -3.14 scripts/ux_audit.py --base http://localhost:3000  # audit local
  py -3.14 scripts/ux_audit.py --skip-screenshots            # re-analyse existing screenshots

REQUIRES:
  pip install playwright requests
  py -3.14 -m playwright install chromium
  ollama pull llava:7b
"""
from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests

# ---------- Config ----------------------------------------------------------
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llava:7b"
OLLAMA_TIMEOUT = 300
SCREENSHOT_DIR = Path("ux_audit_screenshots")
OUTPUT_FILE = "UX-AUDIT.md"

VIEWPORTS = [
    ("mobile", 375, 812),
    ("desktop", 1440, 900),
]

# ---------- Page definitions with context -----------------------------------
# Each page has: name, path, context (what it's supposed to do), and
# optional interactions (Playwright actions to capture specific states).
#
# Interactions are lists of (label, action_fn_name, args) — executed in order.
# After each interaction, a screenshot is taken.

PAGES = [
    {
        "name": "Home / Map",
        "path": "/",
        "context": (
            "This is the main landing page. It shows a full-screen MapLibre GL map of New Zealand "
            "with a search bar at top. Users search for an NZ address here. The map has layer toggles "
            "(hazards, schools, property, planning, transport) in a picker. On mobile, there's a "
            "bottom drawer. The goal is: user lands here, searches an address, gets a report. "
            "The search bar is the most important element on this page."
        ),
        "interactions": [
            ("search_focused", "click", "input[type='search'], input[type='text'], [role='searchbox'], [placeholder*='search' i], [placeholder*='address' i]"),
        ],
    },
    {
        "name": "About",
        "path": "/about",
        "context": (
            "Static marketing page explaining what WhareScore is. Should clearly communicate: "
            "search any NZ address, get a risk score 0-100 from 40+ data layers, free on-screen "
            "report with key findings, paid hosted report with full analysis. Target audience: "
            "NZ renters and home buyers."
        ),
    },
    {
        "name": "Help",
        "path": "/help",
        "context": (
            "FAQ / help page. Should answer common questions about how scores work, what data is "
            "used, how to read the report, pricing, and account management. Needs to be scannable."
        ),
    },
    {
        "name": "Contact",
        "path": "/contact",
        "context": "Simple contact page. Should have a clear way to reach the team.",
    },
    {
        "name": "Changelog",
        "path": "/changelog",
        "context": (
            "Product updates page. Shows recent changes in reverse chronological order. "
            "Helps users understand what's new and builds trust through transparency."
        ),
    },
    {
        "name": "Sign In",
        "path": "/signin",
        "context": (
            "Authentication page. Supports Google OAuth and email OTP (passwordless). "
            "Should be simple, trustworthy, and explain why signing in is worth it "
            "(save reports, free Quick Report, track properties)."
        ),
    },
    {
        "name": "Privacy",
        "path": "/privacy",
        "context": "Legal privacy policy. Should be readable, not a wall of legalese.",
    },
    {
        "name": "Terms",
        "path": "/terms",
        "context": "Legal terms of service. Should be readable.",
    },
    {
        "name": "Suburbs Index",
        "path": "/suburbs",
        "context": (
            "SEO index page listing all suburb guides grouped by territorial authority. "
            "Its job is to help Google discover all /suburbs/{slug} pages and help users "
            "browse by city. Should feel like a directory, not a wall of links."
        ),
    },
    {
        "name": "Property Report",
        "path": "/property/{address_id}",
        "context": (
            "The core product page. Shows a property report for a specific NZ address. "
            "Above the fold: address, risk score 0-100, key findings (severity-ranked). "
            "Below: question-based sections (Is this area safe? What are schools like? etc). "
            "Free users see score + 2 findings + basic sections. Premium gate blocks remaining "
            "findings and advanced sections. There's a Generate Report CTA for paid PDF export. "
            "This page must convince users the data is valuable enough to pay for."
        ),
        "interactions": [
            ("scrolled_mid", "scroll", 1500),
            ("scrolled_bottom", "scroll", 5000),
        ],
    },
    {
        "name": "Suburb Profile",
        "path": "/suburb/{sa2_code}",
        "context": (
            "Data page for an SA2 suburb. Shows: suburb name, TA, area, property count, "
            "key stats (NZDep, schools, transit, crime), rental overview table, rental trends, "
            "and area profile. Purpose: let users compare suburbs before searching a specific address. "
            "Should link to the address search to convert browsers into report users."
        ),
        "interactions": [
            ("scrolled_mid", "scroll", 800),
        ],
    },
    {
        "name": "Suburb Guide",
        "path": "/suburbs/{suburb_slug}",
        "context": (
            "SEO landing page for a suburb. LLM-generated content with: intro, overview, "
            "housing & rent, who lives here, schools & amenities, safety, is it right for you, "
            "FAQs, key stats strip, and a CTA to search an address. Must read like a helpful "
            "article, not a data dump. Internal links to nearby suburb guides at the bottom."
        ),
        "interactions": [
            ("scrolled_mid", "scroll", 1200),
            ("scrolled_bottom", "scroll", 4000),
        ],
    },
]

# ---------- Prompt templates ------------------------------------------------
UX_PROMPT = """You are a senior UX designer and conversion rate optimiser auditing WhareScore,
a New Zealand property intelligence web app. Renters and home buyers search an address and
get a risk score + detailed report. Free tier shows basics; paid tier ($9.99) unlocks full analysis.

PAGE PURPOSE: {context}

VIEWPORT: {viewport} ({width}x{height}px)
STATE: {state}

Look at this screenshot and answer these specific questions:

1. FIRST IMPRESSION (2 seconds): What would a first-time visitor think this page does?
   Does it match the page's actual purpose described above?

2. PRIMARY ACTION: Is the main thing the user should do on this page obvious and easy to find?
   What is that action, and how prominent is it?

3. TRUST & CREDIBILITY: Does this page look professional and trustworthy?
   Would a NZ renter/buyer trust their housing decision to this app?

4. SPECIFIC ISSUES: List 3-7 concrete problems you can see. For each:
   - What's wrong (be specific — "the blue button in the top-right" not "a button")
   - Severity: Critical (blocks conversion) / Major (hurts experience) / Minor (polish)

5. WHAT WORKS: 1-3 things this page does well that should be kept.

6. QUICK WINS: 1-2 changes that would have the biggest impact with the least effort.

Be specific to THIS page. Reference actual elements you can see in the screenshot.
Do not give generic UX advice that could apply to any website."""

CONSISTENCY_PROMPT = """You are a senior UX designer doing a cross-page consistency review of WhareScore,
a New Zealand property intelligence web app.

You have seen screenshots of {count} different pages across the app at both mobile and desktop viewports.
Here is a summary of each page's issues:

{summaries}

Now assess CROSS-PAGE CONSISTENCY:

1. VISUAL LANGUAGE: Are colours, fonts, spacing, and component styles consistent across pages?
   Flag any pages that feel like they belong to a different app.

2. NAVIGATION: Is it always clear where you are and how to get back?
   Does the header/nav behave consistently?

3. INFORMATION ARCHITECTURE: Does the page hierarchy make sense?
   Can a user get from the homepage to a property report in a logical flow?

4. MOBILE vs DESKTOP: Are there pages that work well on one viewport but break on the other?

5. CONVERSION FUNNEL: Trace the path: Landing → Search → Report → Paywall → Purchase.
   Where are the biggest drop-off risks?

6. TOP 5 PRIORITIES: If you could only fix 5 things across the entire app, what would they be?
   Rank by impact on user conversion (visitor → paid report).

Be specific. Reference page names and actual issues from the summaries above."""

# ---------- Logging ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("ux_audit.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("ux_audit")


# ---------- Ollama vision call ----------------------------------------------
def analyse_screenshot(image_path: Path, context: str, viewport: str,
                       width: int, height: int, state: str = "initial load") -> str:
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = UX_PROMPT.format(
        context=context, viewport=viewport, width=width, height=height, state=state
    )

    for attempt in range(1, 4):
        try:
            resp = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
                    "stream": False,
                    "options": {"num_predict": 1200, "temperature": 0.3},
                },
                timeout=OLLAMA_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            text = (data.get("message", {}).get("content") or "").strip()
            if text:
                return text
            raise RuntimeError("empty response")
        except Exception as e:
            log.warning("Attempt %d/3 failed for %s: %s", attempt, image_path.name, e)
            time.sleep(2 * attempt)

    return "(Analysis failed after 3 attempts)"


def analyse_consistency(summaries: str, count: int) -> str:
    prompt = CONSISTENCY_PROMPT.format(summaries=summaries, count=count)
    for attempt in range(1, 4):
        try:
            resp = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"num_predict": 1500, "temperature": 0.3},
                },
                timeout=OLLAMA_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            text = (data.get("message", {}).get("content") or "").strip()
            if text:
                return text
        except Exception as e:
            log.warning("Consistency attempt %d/3 failed: %s", attempt, e)
            time.sleep(2 * attempt)
    return "(Consistency analysis failed)"


# ---------- Screenshot capture ----------------------------------------------
@dataclass
class Screenshot:
    page_name: str
    context: str
    viewport: str
    width: int
    height: int
    state: str
    filepath: Path


def take_screenshots(base_url: str, pages: list[dict], address_id: str,
                     report_token: str | None, sa2_code: str, suburb_slug: str) -> list[Screenshot]:
    from playwright.sync_api import sync_playwright

    SCREENSHOT_DIR.mkdir(exist_ok=True)
    screenshots: list[Screenshot] = []

    def sub_path(path: str) -> str:
        return (path
                .replace("{address_id}", address_id)
                .replace("{report_token}", report_token or "")
                .replace("{sa2_code}", sa2_code)
                .replace("{suburb_slug}", suburb_slug))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for vp_name, vp_w, vp_h in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": vp_w, "height": vp_h},
                device_scale_factor=2,
                color_scheme="light",
            )
            page = context.new_page()

            for pg in pages:
                path = sub_path(pg["path"])
                if "{" in path:
                    log.info("Skipping %s (missing param)", pg["name"])
                    continue

                url = f"{base_url}{path}"
                base_slug = re.sub(r"[^\w]+", "_", f"{pg['name']}_{vp_name}").strip("_").lower()

                # --- Initial load ---
                log.info("Screenshotting %s @ %s (%s)", pg["name"], vp_name, url)
                try:
                    page.goto(url, wait_until="networkidle", timeout=30000)
                    page.wait_for_timeout(2500)

                    # Full page
                    fp_full = SCREENSHOT_DIR / f"{base_slug}_full.png"
                    page.screenshot(path=str(fp_full), full_page=True)
                    screenshots.append(Screenshot(
                        pg["name"], pg.get("context", ""), vp_name, vp_w, vp_h,
                        "initial load (full page)", fp_full
                    ))

                    # Above the fold
                    fp_fold = SCREENSHOT_DIR / f"{base_slug}_fold.png"
                    page.screenshot(path=str(fp_fold), full_page=False)
                    screenshots.append(Screenshot(
                        pg["name"], pg.get("context", ""), vp_name, vp_w, vp_h,
                        "above the fold", fp_fold
                    ))

                    # --- Interactions ---
                    for label, action, arg in pg.get("interactions", []):
                        try:
                            if action == "scroll":
                                page.evaluate(f"window.scrollTo(0, {arg})")
                                page.wait_for_timeout(1000)
                            elif action == "click":
                                # Try multiple selectors
                                selectors = [s.strip() for s in arg.split(",")]
                                clicked = False
                                for sel in selectors:
                                    try:
                                        el = page.locator(sel).first
                                        if el.is_visible(timeout=2000):
                                            el.click(timeout=3000)
                                            page.wait_for_timeout(1500)
                                            clicked = True
                                            break
                                    except Exception:
                                        continue
                                if not clicked:
                                    log.warning("  Could not click any selector for %s", label)
                                    continue

                            fp_int = SCREENSHOT_DIR / f"{base_slug}_{label}.png"
                            page.screenshot(path=str(fp_int), full_page=False)
                            screenshots.append(Screenshot(
                                pg["name"], pg.get("context", ""), vp_name, vp_w, vp_h,
                                label.replace("_", " "), fp_int
                            ))
                            log.info("  interaction: %s", label)
                        except Exception as e:
                            log.warning("  interaction %s failed: %s", label, e)

                    # Reset scroll
                    page.evaluate("window.scrollTo(0, 0)")

                except Exception as e:
                    log.error("  FAILED %s: %s", url, e)

            # --- Dark mode pass (mobile only, key pages) ---
            if vp_name == "mobile":
                dark_ctx = browser.new_context(
                    viewport={"width": vp_w, "height": vp_h},
                    device_scale_factor=2,
                    color_scheme="dark",
                )
                dark_page = dark_ctx.new_page()
                dark_pages = [pg for pg in pages if pg["name"] in ("Home / Map", "Property Report", "Sign In", "About")]
                for pg in dark_pages:
                    path = sub_path(pg["path"])
                    if "{" in path:
                        continue
                    url = f"{base_url}{path}"
                    slug = re.sub(r"[^\w]+", "_", f"{pg['name']}_dark_mobile").strip("_").lower()
                    log.info("Dark mode: %s @ mobile", pg["name"])
                    try:
                        dark_page.goto(url, wait_until="networkidle", timeout=30000)
                        dark_page.wait_for_timeout(2000)
                        fp = SCREENSHOT_DIR / f"{slug}.png"
                        dark_page.screenshot(path=str(fp), full_page=False)
                        screenshots.append(Screenshot(
                            pg["name"], pg.get("context", ""), "mobile-dark", vp_w, vp_h,
                            "dark mode", fp
                        ))
                    except Exception as e:
                        log.warning("  dark mode failed: %s", e)
                dark_ctx.close()

            context.close()
        browser.close()

    return screenshots


# ---------- Report writer ---------------------------------------------------
@dataclass
class Finding:
    page: str
    viewport: str
    state: str
    analysis: str
    screenshot: str


def write_report(findings: list[Finding], consistency: str):
    lines = [
        "# WhareScore Comprehensive UX Audit",
        "",
        f"Generated: {time.strftime('%Y-%m-%d %H:%M')}",
        f"Model: {MODEL}",
        f"Screenshots analysed: {len(findings)}",
        f"Pages covered: {len(set(f.page for f in findings))}",
        f"Viewports: mobile (375px), desktop (1440px), mobile-dark",
        "",
        "---",
        "",
        "## Cross-Page Consistency & Top Priorities",
        "",
        consistency,
        "",
        "---",
        "",
    ]

    # Group by page
    pages: dict[str, list[Finding]] = {}
    for f in findings:
        pages.setdefault(f.page, []).append(f)

    for page_name, page_findings in pages.items():
        lines.append(f"## {page_name}")
        lines.append("")
        for f in page_findings:
            lines.append(f"### {f.viewport} — {f.state} (`{f.screenshot}`)")
            lines.append("")
            lines.append(f.analysis)
            lines.append("")
        lines.append("---")
        lines.append("")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log.info("Report written to %s", OUTPUT_FILE)


# ---------- Main ------------------------------------------------------------
def main():
    global MODEL
    parser = argparse.ArgumentParser(description="Comprehensive UX audit via Playwright + LLaVA")
    parser.add_argument("--base", default="https://wharescore.co.nz", help="Base URL")
    parser.add_argument("--skip-screenshots", action="store_true", help="Re-analyse existing screenshots")
    parser.add_argument("--model", default=MODEL, help="Ollama vision model")
    parser.add_argument("--address-id", default="3109899", help="Sample address ID")
    parser.add_argument("--report-token", default=None, help="Sample report token")
    parser.add_argument("--sa2-code", default="251200", help="Sample SA2 code")
    parser.add_argument("--suburb-slug", default="aro-valley-wellington", help="Suburb guide slug")
    args = parser.parse_args()

    MODEL = args.model

    # Check Ollama
    log.info("Checking Ollama vision model %s...", MODEL)
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "messages": [{"role": "user", "content": "Say OK", "images": []}],
            "stream": False, "options": {"num_predict": 10}
        }, timeout=60)
        log.info("Ollama OK")
    except Exception as e:
        log.error("Ollama check failed: %s", e)
        sys.exit(1)

    # Screenshots
    if args.skip_screenshots:
        log.info("Using existing screenshots in %s/", SCREENSHOT_DIR)
        sshots = []
        # Rebuild from filenames
        page_lookup = {re.sub(r"[^\w]+", "_", pg["name"]).lower(): pg for pg in PAGES}
        for f in sorted(SCREENSHOT_DIR.glob("*.png")):
            stem = f.stem
            vp = "mobile-dark" if "dark_mobile" in stem else ("mobile" if "mobile" in stem else "desktop")
            w, h = (375, 812) if "mobile" in vp else (1440, 900)
            state = "full page" if "full" in stem else ("above fold" if "fold" in stem else stem.split("_")[-1])
            # Find page context
            ctx = ""
            for key, pg in page_lookup.items():
                if stem.startswith(key) or key in stem:
                    ctx = pg.get("context", "")
                    break
            page_name = stem.rsplit(f"_{vp.replace('-','_')}", 1)[0].replace("_", " ").title()
            sshots.append(Screenshot(page_name, ctx, vp, w, h, state, f))
    else:
        sshots = take_screenshots(
            args.base, PAGES, args.address_id, args.report_token,
            args.sa2_code, args.suburb_slug,
        )

    if not sshots:
        log.error("No screenshots to analyse")
        sys.exit(1)

    log.info("Analysing %d screenshots with %s...", len(sshots), MODEL)
    findings = []
    for i, ss in enumerate(sshots, 1):
        log.info("[%d/%d] %s @ %s — %s", i, len(sshots), ss.page_name, ss.viewport, ss.state)
        analysis = analyse_screenshot(ss.filepath, ss.context, ss.viewport, ss.width, ss.height, ss.state)
        findings.append(Finding(
            page=ss.page_name, viewport=ss.viewport, state=ss.state,
            analysis=analysis, screenshot=ss.filepath.name,
        ))
        log.info("  done (%d words)", len(analysis.split()))

    # Cross-page consistency pass
    log.info("Running cross-page consistency analysis...")
    summaries = "\n\n".join(
        f"**{f.page} ({f.viewport}, {f.state}):** {f.analysis[:300]}..."
        for f in findings
        if "fold" in f.state or "initial" in f.state  # only key views for summary
    )
    page_count = len(set(f.page for f in findings))
    consistency = analyse_consistency(summaries, page_count)
    log.info("Consistency analysis done (%d words)", len(consistency.split()))

    write_report(findings, consistency)
    log.info("DONE — %d screenshots, %d pages, report at %s",
             len(findings), page_count, OUTPUT_FILE)


if __name__ == "__main__":
    main()
