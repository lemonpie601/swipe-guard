/*! 스와이프 가드 1.0.0
 * - AI 응답 아래의 < 1/1 > 스와이프 바를 숨기고, 하단 아이콘 줄에 작은 스와이프 아이콘으로 옮겨요.
 *   아이콘을 누르면 ‹ 1/3 › 작은 창이 열려요.
 * - 재응답(다음 스와이프 생성 / Regenerate)을 누르면 먼저 확인 창을 띄워요.
 *   (터치 기기는 마리나라가 원래 확인 창을 띄우므로 이중으로 묻지 않아요.) */
(() => {
  "use strict";

  const READY_ATTR = "data-mscx-ready";
  const REGEN_LABEL = /스와이프 생성|next swipe|^regenerate( \(guided\))?$|재생성|다시 생성/i;
  const NOT_REGEN = /voice|음성|scene|plot|schedule|sheet|selected|장면|일정/i;
  const ICON_LAYERS =
    '<svg xmlns="http://www.w3.org/2000/svg" width="0.95rem" height="0.95rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>';
  const ICON_LEFT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const ICON_RIGHT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

  const cleanupFns = [];
  let bypass = false;
  let dialogOpen = false;
  let pop = null; // { el, swipes }
  let frame = 0;

  const labelOf = (btn) => (btn.getAttribute("aria-label") || btn.getAttribute("title") || "").trim();

  function isRegenButton(btn) {
    const label = labelOf(btn);
    return !!label && REGEN_LABEL.test(label) && !NOT_REGEN.test(label);
  }

  // ── 스와이프 바 읽기 ─────────────────────────────────────────
  function readSwipes(swipes) {
    const buttons = swipes.querySelectorAll(":scope > button");
    const prev = buttons[0] || null;
    const next = buttons[buttons.length - 1] || null;
    const input = swipes.querySelector("input");
    const totalText = [...swipes.querySelectorAll("span")].map((s) => s.textContent.trim()).find((t) => /^\/\d+$/.test(t));
    const cur = input ? input.value : "?";
    const total = totalText ? totalText.slice(1) : "?";
    return { prev, next, cur, total, nextGenerates: !!next && isRegenButton(next) };
  }

  // 스와이프 바와 같은 메시지 묶음 안에 있는 아이콘 줄 찾기
  function findActions(swipes) {
    let p = swipes.parentElement;
    for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
      if (p.classList.contains("mari-messages-scroll")) return null;
      const row = p.querySelector(".mari-message-actions");
      if (row) return { row, group: p };
    }
    return null;
  }

  // ── 아이콘 달기 ─────────────────────────────────────────────
  function sync() {
    frame = 0;
    for (const swipes of document.querySelectorAll(".mari-message-swipes")) {
      const found = findActions(swipes);
      if (!found) continue;
      const { row, group } = found;
      let btn = row.querySelector(":scope > .mscx-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        const sample = row.querySelector(":scope > button.mari-chat-message-action");
        btn.className = (sample ? sample.className : "mari-chat-style-control mari-chat-message-action inline-flex items-center justify-center") + " mscx-btn";
        btn.innerHTML = ICON_LAYERS + '<span class="mscx-count"></span>';
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const sw = btn.__mscxSwipes;
          if (pop && pop.swipes === sw) closePop();
          else if (sw) openPop(btn, sw);
        });
        row.appendChild(btn);
      }
      btn.__mscxSwipes = swipes;
      const info = readSwipes(swipes);
      const text = `${info.cur}/${info.total}`;
      const countEl = btn.querySelector(".mscx-count");
      if (countEl.textContent !== text) countEl.textContent = text;
      const title = `스와이프 ${text}`;
      if (btn.title !== title) {
        btn.title = title;
        btn.setAttribute("aria-label", title);
      }
      if (!group.hasAttribute(READY_ATTR)) group.setAttribute(READY_ATTR, "");
    }
    if (pop) {
      if (!pop.swipes.isConnected) closePop();
      else renderPop();
    }
  }

  function schedule() {
    // rAF는 백그라운드 탭에서 멈추므로 짧은 타이머로 묶어요.
    if (!frame) frame = setTimeout(sync, 40);
  }

  // ── 작은 스와이프 창 ────────────────────────────────────────
  function openPop(anchor, swipes) {
    closePop();
    const el = document.createElement("div");
    el.className = "mscx-pop";
    // role="dialog"가 있어야 '확장 서랍' 같은 런처 수집 확장이 이 창을 숨기지 않아요.
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "스와이프");
    el.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(el);
    pop = { el, swipes, anchor };
    renderPop();
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = a.left + a.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = a.top - h - 6;
    if (top < 8) top = a.bottom + 6;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function renderPop() {
    const { el, swipes } = pop;
    const info = readSwipes(swipes);
    const key = [info.cur, info.total, info.prev?.disabled, info.next?.disabled, info.nextGenerates].join("|");
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = "";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.innerHTML = ICON_LEFT;
    prev.title = "이전 스와이프";
    prev.disabled = !info.prev || info.prev.disabled;
    prev.addEventListener("click", () => info.prev && info.prev.click());

    const count = document.createElement("span");
    count.className = "mscx-pop-count";
    count.textContent = `${info.cur} / ${info.total}`;

    const next = document.createElement("button");
    next.type = "button";
    next.disabled = !info.next || info.next.disabled;
    if (info.nextGenerates) {
      next.className = "mscx-gen";
      next.innerHTML = "재응답" + ICON_RIGHT;
      next.title = "다음 스와이프 생성 (재응답)";
    } else {
      next.innerHTML = ICON_RIGHT;
      next.title = "다음 스와이프";
    }
    // 원래 버튼을 대신 눌러요. 재응답이면 아래 확인 창이 가로채요.
    next.addEventListener("click", () => info.next && info.next.click());

    el.append(prev, count, next);
  }

  function closePop() {
    if (!pop) return;
    pop.el.remove();
    pop = null;
  }

  // ── 재응답 확인 창 ──────────────────────────────────────────
  function confirmRegen() {
    return new Promise((resolve) => {
      dialogOpen = true;
      const overlay = document.createElement("div");
      overlay.className = "mscx-overlay";
      overlay.innerHTML =
        '<div class="mscx-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mscx-title">' +
        '<h3 id="mscx-title">재응답 받을까요?</h3>' +
        "<p>이 메시지에 새 스와이프를 생성해요.</p>" +
        '<div class="mscx-dialog-actions">' +
        '<button type="button" class="mscx-cancel">취소</button>' +
        '<button type="button" class="mscx-ok">재응답</button>' +
        "</div></div>";
      const done = (ok) => {
        dialogOpen = false;
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        resolve(ok);
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done(false);
        }
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) done(false);
      });
      overlay.querySelector(".mscx-cancel").addEventListener("click", () => done(false));
      overlay.querySelector(".mscx-ok").addEventListener("click", () => done(true));
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(overlay);
      overlay.querySelector(".mscx-cancel").focus();
    });
  }

  function onClickCapture(e) {
    if (bypass) return;
    const btn = e.target instanceof Element ? e.target.closest("button") : null;
    if (!btn || btn.disabled || btn.closest(".mscx-pop, .mscx-overlay")) return;
    if (!isRegenButton(btn)) return;
    // 터치 기기는 마리나라가 원래 확인 창을 띄워요.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (dialogOpen) return;
    closePop();
    confirmRegen().then((ok) => {
      if (!ok || !btn.isConnected) return;
      bypass = true;
      try {
        btn.click();
      } finally {
        bypass = false;
      }
    });
  }

  function onDocClick(e) {
    if (pop && !(e.target instanceof Element && e.target.closest(".mscx-pop, .mscx-btn"))) closePop();
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && pop) closePop();
  }

  function install() {
    window.addEventListener("click", onClickCapture, true);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closePop);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "aria-label"] });
    schedule();
    cleanupFns.push(() => {
      window.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closePop);
      observer.disconnect();
      if (frame) clearTimeout(frame);
      closePop();
      document.querySelectorAll(".mscx-btn, .mscx-overlay").forEach((n) => n.remove());
      document.querySelectorAll(`[${READY_ATTR}]`).forEach((n) => n.removeAttribute(READY_ATTR));
    });
  }

  function cleanup() {
    for (const fn of cleanupFns.splice(0)) {
      try {
        fn();
      } catch {}
    }
  }

  try {
    if (typeof marinara !== "undefined" && typeof marinara?.onCleanup === "function") marinara.onCleanup(cleanup);
  } catch {}
  window.__mscxCleanup = cleanup;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
