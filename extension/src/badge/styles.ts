// Shadow DOM stylesheet. Kept as a TS constant (rather than an imported CSS
// file) so content scripts don't need web_accessible_resources juggling —
// the shadow root adopts this via CSSStyleSheet.replaceSync at mount time.
export const BADGE_CSS = `
:host {
  all: initial;
  --ws-bg: #ffffff;
  --ws-fg: #0f1720;
  --ws-muted: #5a6b7b;
  --ws-border: rgba(15, 23, 32, 0.12);
  --ws-green: #0D7377;
  --ws-amber: #E69F00;
  --ws-red:   #C42D2D;
  --ws-primary: #134e4a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.ws-card {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 320px;
  min-height: 180px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--ws-bg);
  color: var(--ws-fg);
  border: 1px solid var(--ws-border);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 14px 16px;
  z-index: 2147483646;
  transform: translateX(420px);
  transition: transform 220ms cubic-bezier(.2,.9,.3,1.2);
}
.ws-card.ws-in { transform: translateX(0); }
@media (prefers-reduced-motion: reduce) {
  .ws-card { transition: none; }
}

.ws-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
  user-select: none;
  margin-bottom: 6px;
}
.ws-header:active { cursor: grabbing; }

.ws-brand {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--ws-primary);
  letter-spacing: 0.02em;
}
.ws-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--ws-primary);
}
.ws-dismiss {
  border: 0; background: transparent; cursor: pointer;
  color: var(--ws-muted); font-size: 16px; padding: 2px 6px; line-height: 1;
}
.ws-dismiss:hover { color: var(--ws-fg); }

.ws-score-row { display: flex; align-items: baseline; gap: 10px; margin-top: 2px; }
.ws-score { font-size: 48px; font-weight: 700; line-height: 1; }
.ws-score--low    { color: var(--ws-green); }
.ws-score--mid    { color: var(--ws-amber); }
.ws-score--high   { color: var(--ws-red); }
.ws-band { font-size: 12px; color: var(--ws-muted); font-weight: 500; }
.ws-pro-tag {
  display: inline-block; margin-left: auto;
  background: var(--ws-primary); color: #fff;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
  padding: 2px 6px; border-radius: 4px;
}

.ws-address {
  margin: 6px 0 10px;
  font-size: 12px;
  color: var(--ws-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.ws-findings { list-style: none; padding: 0; margin: 0 0 10px; }
.ws-finding {
  font-size: 12px; line-height: 1.35;
  padding: 6px 8px; margin-bottom: 4px;
  border-radius: 6px; border: 1px solid var(--ws-border);
  display: flex; align-items: flex-start; gap: 6px;
}
.ws-chip {
  flex: none;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  padding: 2px 5px; border-radius: 3px; letter-spacing: 0.05em;
}
.ws-chip--critical { background: #fdecea; color: var(--ws-red); }
.ws-chip--warning  { background: #fdf3e3; color: var(--ws-amber); }
.ws-chip--info     { background: #e8effa; color: #1d4ed8; }
.ws-chip--positive { background: #e3f3ee; color: var(--ws-green); }
.ws-chip--lock     { background: #f2f2f5; color: var(--ws-muted); }

.ws-footer {
  display: flex; gap: 8px; align-items: center;
  position: sticky; bottom: 0;
  background: var(--ws-bg);
  padding-top: 8px; margin-top: 4px;
  border-top: 1px solid #f0f0f0;
  z-index: 1;
}
.ws-toggle {
  display: block; width: 100%;
  font-size: 12px; font-weight: 600;
  padding: 6px 8px; margin: 0 0 8px;
  border: 1px solid var(--ws-border); border-radius: 6px;
  background: #f7f9fa; color: var(--ws-primary);
  cursor: pointer; text-align: left;
}
.ws-toggle:hover { background: #e8f1f0; border-color: var(--ws-primary); }
.ws-toggle:focus-visible {
  outline: 2px solid var(--ws-primary);
  outline-offset: 2px;
}
.ws-market { display: block; }
.ws-market[hidden] { display: none; }
.ws-btn {
  font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--ws-border); background: #fff; color: var(--ws-fg);
  cursor: pointer;
}
.ws-btn:hover:not(:disabled) { background: #e8f1f0; border-color: var(--ws-primary); }
.ws-btn:disabled { color: var(--ws-muted); cursor: not-allowed; }
.ws-btn:focus-visible,
.ws-open:focus-visible,
.ws-dismiss:focus-visible {
  outline: 2px solid var(--ws-primary);
  outline-offset: 2px;
  border-radius: 6px;
}
.ws-btn--primary {
  background: var(--ws-primary); color: #fff; border-color: var(--ws-primary);
}
.ws-btn--primary:hover { background: #0b3d3a; }
.ws-footer a { font-size: 12px; color: var(--ws-primary); text-decoration: none; }
.ws-footer a:hover { text-decoration: underline; }

.ws-state { font-size: 12px; color: var(--ws-muted); padding: 8px 0; }
.ws-skeleton { display: flex; flex-direction: column; gap: 6px; padding: 6px 0; }
.ws-skeleton-bar {
  height: 12px; border-radius: 4px;
  background: linear-gradient(90deg, #eef1f5, #f7f9fa, #eef1f5);
  background-size: 200% 100%;
  animation: ws-shimmer 1.4s linear infinite;
}
.ws-skeleton-bar.long { width: 85%; }
.ws-skeleton-bar.short { width: 50%; }
@keyframes ws-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.ws-ambiguous {
  display: inline-block; margin-left: 6px;
  background: #f2f2f5; color: var(--ws-muted);
  font-size: 10px; padding: 2px 6px; border-radius: 3px;
}

@media (max-width: 480px) {
  .ws-card { max-height: 60vh; }
  .ws-btn { padding: 12px 14px; font-size: 14px; min-height: 44px; }
  .ws-dismiss { padding: 10px 12px; min-width: 44px; min-height: 44px; }
}
`;
