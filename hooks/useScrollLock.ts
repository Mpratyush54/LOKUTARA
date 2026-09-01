"use client";

import { useEffect } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const { body } = document;
    const y = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlBehavior: html.style.scrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    html.style.scrollBehavior = "auto";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      html.style.scrollBehavior = "auto";
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, y);
      html.style.scrollBehavior = prev.htmlBehavior;
    };
  }, [locked]);
}

export function scrollPageTo(el: Element, instant = false) {
  el.classList.add("is-visible");
  const header = document.querySelector(".topnav")?.getBoundingClientRect().height ?? 80;
  const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - header - 12);
  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  if (instant || prefersReducedMotion() || Math.abs(window.scrollY - top) < 8) {
    window.scrollTo(0, top);
    html.style.scrollBehavior = prev;
    return;
  }
  const start = window.scrollY;
  const dist = top - start;
  const duration = Math.min(560, Math.max(280, Math.abs(dist) * 0.22));
  let t0: number | null = null;
  const ease = (t: number) => 1 - (1 - t) ** 3;
  const tick = (now: number) => {
    if (t0 == null) t0 = now;
    const p = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + dist * ease(p));
    if (p < 1) requestAnimationFrame(tick);
    else html.style.scrollBehavior = prev;
  };
  requestAnimationFrame(tick);
}
