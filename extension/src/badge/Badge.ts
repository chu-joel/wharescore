// Shadow-DOM badge. Vanilla TS so each content script stays small.
//
// Render contract: the backend tells us what the user is entitled to via
// `tier` + `capabilities.*` + presence of optional fields (price_band,
// price_estimate, rent_estimate, walk_score, schools). The client does not
// reconstruct that mapping — it just renders what's there.
import type {
  BadgeResponse, Capabilities, Finding, PriceBand, PriceEstimate,
  RentEstimate, SchoolRow, SourceSite, Tier,
} from "@/lib/constants";
import { dismissAddress, isDismissed } from "@/lib/storage";
import { BADGE_CSS } from "./styles";

const HOST_ATTR = "data-wharescore-badge";
const DRAG_KEY = "badgeOffset";
const SIGN_IN_URL = "https://wharescore.co.nz/signin?callbackUrl=/";
const UPGRADE_URL = "https://wharescore.co.nz/account?plan=pro";

export interface BadgeHandlers {
  onSave: (addressId: number, fullAddress: string) => Promise<void>;
  onRetry: () => Promise<void>;
  site: SourceSite;
}

export class Badge {
  private host: HTMLElement;
  private root: ShadowRoot;
  private card: HTMLDivElement;
  private addressId: number | null = null;
  private handlers: BadgeHandlers;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private dragState = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
  // Pro-tier progressive disclosure state. Both default to collapsed so the
  // first paint stays inside the brief's 320×180 budget; user clicks reveal.
  private _findingsExpanded = false;
  private _marketExpanded = false;

  constructor(handlers: BadgeHandlers) {
    this.handlers = handlers;
    const existing = document.querySelector(`div[${HOST_ATTR}]`);
    if (existing) existing.remove();
    this.host = document.createElement("div");
    this.host.setAttribute(HOST_ATTR, "1");
    this.root = this.host.attachShadow({ mode: "open" });
    this.card = document.createElement("div");
    this.card.className = "ws-card";
    this.injectStyles();
    this.root.appendChild(this.card);
    document.documentElement.appendChild(this.host);
    requestAnimationFrame(() => this.card.classList.add("ws-in"));
  }

  private injectStyles() {
    const supportsAdoptedSheets = "adoptedStyleSheets" in this.root;
    if (supportsAdoptedSheets) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(BADGE_CSS);
      (this.root as ShadowRoot & { adoptedStyleSheets: CSSStyleSheet[] }).adoptedStyleSheets = [sheet];
    } else {
      const style = document.createElement("style");
      style.textContent = BADGE_CSS;
      this.root.appendChild(style);
    }
  }

  renderLoading() {
    this.card.innerHTML = `
      <div class="ws-header">
        <div class="ws-brand"><span class="ws-dot"></span>WHARESCORE</div>
        <button class="ws-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="ws-skeleton">
        <div class="ws-skeleton-bar long"></div>
        <div class="ws-skeleton-bar short"></div>
        <div class="ws-skeleton-bar long"></div>
      </div>
    `;
    this.wireHeaderControls();
  }

  renderError(message: string) {
    this.card.innerHTML = `
      <div class="ws-header">
        <div class="ws-brand"><span class="ws-dot"></span>WHARESCORE</div>
        <button class="ws-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="ws-state">${escape(message)}</div>
      <div class="ws-footer">
        <button class="ws-btn ws-retry">Try again</button>
      </div>
    `;
    this.wireHeaderControls();
    this.root.querySelector(".ws-retry")?.addEventListener("click", () => this.handlers.onRetry());
  }

  renderData(data: BadgeResponse) {
    if (!data.matched) { this.remove(); return; }
    this.addressId = data.address_id ?? null;
    const tier: Tier = data.tier ?? "anon";
    const caps: Capabilities = data.capabilities ?? {
      save: false, watchlist: false, alerts: false, pdf_export: false,
    };
    const score = typeof data.score === "number" ? data.score : null;
    const bandClass = score == null ? "ws-score--low"
      : score >= 60 ? "ws-score--high"
      : score >= 30 ? "ws-score--mid"
      : "ws-score--low";
    const proTag = tier === "pro" ? `<span class="ws-pro-tag">PRO</span>` : "";
    const reportUrl = data.report_url || "https://wharescore.co.nz";

    // Ambiguous match: render minimal card. Per brief §Address matching step 6,
    // findings/price/save are suppressed because they may belong to the wrong
    // property — only the score-for-first and a "View full report" link remain.
    if (data.ambiguous) {
      this.card.innerHTML = `
        <div class="ws-header">
          <div class="ws-brand"><span class="ws-dot"></span>WHARESCORE${proTag ? ` ${proTag}` : ""}</div>
          <button class="ws-dismiss" aria-label="Dismiss">×</button>
        </div>
        <div class="ws-score-row">
          <div class="ws-score ${bandClass}">${score ?? "—"}</div>
          <div class="ws-band">${escape(data.score_band || "")}<span class="ws-ambiguous">Multiple matches</span></div>
        </div>
        <div class="ws-address" title="${escape(data.full_address || "")}">${escape(data.full_address || "")}</div>
        <div class="ws-state">Multiple addresses match — open the full report to confirm which one</div>
        <div class="ws-footer">
          <a class="ws-open" href="${reportUrl}" target="_blank" rel="noopener noreferrer">View full report →</a>
        </div>
      `;
      this.wireHeaderControls();
      this.applyStoredOffset();
      return;
    }

    const canSave = caps.save;
    const persona = data.persona ?? null;
    const findings = data.findings ?? [];

    // Pro: progressive disclosure — top 2 findings up front + chevron toggle for
    // findings 3+, plus a single collapsible "Market & area" block for the data
    // grid (price/rent/walk/schools). Anon/Free render as before.
    let bodyHtml = "";
    if (tier === "pro") {
      const visibleFindings = this._findingsExpanded ? findings : findings.slice(0, 2);
      const hiddenCount = Math.max(0, findings.length - 2);
      const findingsToggle = hiddenCount > 0 ? `
        <button class="ws-toggle ws-findings-toggle"
          aria-expanded="${this._findingsExpanded}"
          aria-controls="ws-findings-list">
          ${this._findingsExpanded ? `Hide ${hiddenCount} finding${hiddenCount === 1 ? "" : "s"} ▴` : `Show ${hiddenCount} more finding${hiddenCount === 1 ? "" : "s"} ▾`}
        </button>` : "";

      const marketParts = [
        renderPriceSection(data.price_band, data.price_estimate),
        renderRentSection(data.rent_estimate, persona),
        renderWalkSection(data.walk_score),
        renderSchoolsSection(data.schools),
      ].filter((s) => s !== "");
      const marketInner = marketParts.join("");
      const marketBlock = marketInner ? `
        <button class="ws-toggle ws-market-toggle"
          aria-expanded="${this._marketExpanded}"
          aria-controls="ws-market-block">
          Market & area ${this._marketExpanded ? "▴" : "▾"}
        </button>
        <div class="ws-market" id="ws-market-block" aria-hidden="${!this._marketExpanded}" ${this._marketExpanded ? "" : "hidden"}>
          ${marketInner}
        </div>` : "";

      bodyHtml = `
        <ul class="ws-findings" id="ws-findings-list">${renderFindingList(visibleFindings, tier)}</ul>
        ${findingsToggle}
        ${marketBlock}
      `;
    } else {
      const findingsHtml = renderFindingList(findings, tier);
      bodyHtml = `
        <ul class="ws-findings">${findingsHtml}</ul>
        ${renderPriceSection(data.price_band, data.price_estimate)}
        ${renderRentSection(data.rent_estimate, persona)}
        ${renderWalkSection(data.walk_score)}
        ${renderSchoolsSection(data.schools)}
        ${renderUpgradeHint(tier)}
      `;
    }

    this.card.innerHTML = `
      <div class="ws-header">
        <div class="ws-brand"><span class="ws-dot"></span>WHARESCORE${proTag ? ` ${proTag}` : ""}</div>
        <button class="ws-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="ws-score-row">
        <div class="ws-score ${bandClass}">${score ?? "—"}</div>
        <div class="ws-band">${escape(data.score_band || "")}</div>
      </div>
      <div class="ws-address" title="${escape(data.full_address || "")}">${escape(data.full_address || "")}</div>
      ${bodyHtml}
      <div class="ws-footer">
        <button class="ws-btn ws-save" ${canSave ? "" : "disabled"} title="${canSave ? "" : saveTooltip(tier)}">Save</button>
        <a class="ws-open" href="${reportUrl}" target="_blank" rel="noopener noreferrer">View full report →</a>
      </div>
    `;
    this.wireHeaderControls();
    this.wireActionButtons(data);
    this.applyStoredOffset();
  }

  remove() {
    this.card.classList.remove("ws-in");
    setTimeout(() => this.host.remove(), 240);
  }

  private wireHeaderControls() {
    this.root.querySelector(".ws-dismiss")?.addEventListener("click", async () => {
      if (this.addressId != null) await dismissAddress(this.addressId);
      this.remove();
    });
    const header = this.root.querySelector(".ws-header") as HTMLElement | null;
    if (header) {
      header.addEventListener("pointerdown", (e) => this.startDrag(e as PointerEvent));
    }
  }

  private wireActionButtons(data: BadgeResponse) {
    // Pro toggles. Vanilla DOM — flip state, re-render. Cheap because the card
    // is small and the toggles are user-driven (not animation-frame hot paths).
    this.root.querySelector(".ws-findings-toggle")?.addEventListener("click", () => {
      this._findingsExpanded = !this._findingsExpanded;
      this.renderData(data);
    });
    this.root.querySelector(".ws-market-toggle")?.addEventListener("click", () => {
      this._marketExpanded = !this._marketExpanded;
      this.renderData(data);
    });
    this.root.querySelector(".ws-save")?.addEventListener("click", async () => {
      if (data.address_id == null || !data.full_address) return;
      const btn = this.root.querySelector<HTMLButtonElement>(".ws-save");
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await this.handlers.onSave(data.address_id, data.full_address);
        btn.textContent = "Saved ✓";
      } catch {
        btn.textContent = "Try again";
        btn.disabled = false;
      }
    });
  }

  private async applyStoredOffset() {
    try {
      const res = await chrome.storage.sync.get(DRAG_KEY);
      const stored = res[DRAG_KEY] as Record<string, { x: number; y: number }> | undefined;
      const offset = stored?.[this.handlers.site];
      if (offset) {
        this.dragOffset = offset;
        this.card.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
      }
    } catch {
      // position persistence is non-critical
    }
  }

  private startDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".ws-dismiss")) return;
    this.dragState = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: this.dragOffset.x,
      origY: this.dragOffset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => this.onDragMove(ev);
    const onUp = (ev: PointerEvent) => this.onDragEnd(ev, onMove, onUp);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  private onDragMove(e: PointerEvent) {
    if (!this.dragState.active) return;
    const dx = e.clientX - this.dragState.startX;
    const dy = e.clientY - this.dragState.startY;
    this.dragOffset = {
      x: this.dragState.origX - dx,
      y: this.dragState.origY - dy,
    };
    this.card.style.transform = `translate(${-this.dragOffset.x}px, ${-this.dragOffset.y}px)`;
  }

  private async onDragEnd(_e: PointerEvent, onMove: (ev: PointerEvent) => void, onUp: (ev: PointerEvent) => void) {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    this.dragState.active = false;
    try {
      const res = await chrome.storage.sync.get(DRAG_KEY);
      const stored = (res[DRAG_KEY] as Record<string, { x: number; y: number }>) ?? {};
      stored[this.handlers.site] = this.dragOffset;
      await chrome.storage.sync.set({ [DRAG_KEY]: stored });
    } catch {
      // non-critical
    }
  }
}

function renderFindingList(findings: Finding[], tier: Tier): string {
  if (!findings.length) {
    return `<li class="ws-finding"><span class="ws-chip ws-chip--positive">OK</span>
      <span>No findings flagged for this property.</span></li>`;
  }
  const lines = findings.map((f) => `
    <li class="ws-finding">
      <span class="ws-chip ws-chip--${f.severity}">${chipLabel(f.severity)}</span>
      <span>${escape(f.title)}</span>
    </li>
  `);
  if (tier === "anon") {
    lines.push(`<li class="ws-finding">
      <span class="ws-chip ws-chip--lock">🔒</span>
      <span><a href="${SIGN_IN_URL}" target="_blank" rel="noopener noreferrer">Sign in for persona-tailored findings</a></span>
    </li>`);
  }
  return lines.join("");
}

function renderPriceSection(
  band: PriceBand | undefined,
  est: PriceEstimate | null | undefined,
): string {
  if (est && est.median != null) {
    const comps = est.comps && est.comps.length ? ` · ${est.comps.length} comp${est.comps.length === 1 ? "" : "s"}` : "";
    const confidence = est.confidence != null ? ` · ${Math.round(est.confidence * 100)}% conf` : "";
    return `<div class="ws-state">Est. $${fmt(est.median)} (range $${fmt(est.low)}–$${fmt(est.high)})${confidence}${comps}</div>`;
  }
  if (band) {
    return `<div class="ws-state">Rough price: $${fmt(band.low)}–$${fmt(band.high)}</div>`;
  }
  return "";
}

function renderRentSection(
  est: RentEstimate | null | undefined,
  persona: string | null | undefined,
): string {
  if (!est || est.median == null) return "";
  // Yield is a buyer/investor signal — renters don't care about it. Hide for
  // the renter persona; show for buyer (and unknown persona, which defaults
  // to the fuller view).
  const showYield = persona !== "renter" && est.yield_percent != null;
  const yld = showYield ? ` · ${est.yield_percent}% gross yield` : "";
  return `<div class="ws-state">Rent est. $${est.median}/wk${yld}</div>`;
}

function renderWalkSection(score: number | null | undefined): string {
  if (score == null) return "";
  return `<div class="ws-state">Walk score ${score}</div>`;
}

function renderSchoolsSection(schools: SchoolRow[] | null | undefined): string {
  if (!schools || schools.length === 0) return "";
  const top = schools.slice(0, 2).map((s) => {
    const name = escape(s.name || "School");
    const deci = s.decile != null ? ` · decile ${s.decile}` : "";
    const zone = s.zone === "in-zone" ? " ✓" : "";
    return `${name}${deci}${zone}`;
  }).join(" · ");
  return `<div class="ws-state">${top}</div>`;
}

function renderUpgradeHint(tier: Tier): string {
  if (tier === "pro") return "";
  if (tier === "free") {
    return `<div class="ws-state">
      <a href="${UPGRADE_URL}" target="_blank" rel="noopener noreferrer">Upgrade to Pro</a>
      for price estimate, rent + yield, walk score, email alerts on similar listings, and PDF export.
    </div>`;
  }
  // Anon: the locked-row in renderFindingList already shows the sign-in CTA;
  // a second one here would be redundant.
  return "";
}

function saveTooltip(tier: Tier): string {
  if (tier === "anon") return "Sign in to save";
  return "";
}

function chipLabel(severity: string): string {
  switch (severity) {
    case "critical": return "CRITICAL";
    case "warning":  return "WATCH";
    case "info":     return "NOTE";
    case "positive": return "GOOD";
    default:         return "";
  }
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-NZ");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function shouldSkipForDismissal(addressId: number | null): Promise<boolean> {
  if (addressId == null) return false;
  return await isDismissed(addressId);
}
