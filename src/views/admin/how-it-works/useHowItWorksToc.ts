import { useCallback, useEffect, useRef, useState } from "react";
import { TOC_ITEMS, type TocId } from "./components/TableOfContents";

const DEFAULT_ID: TocId = TOC_ITEMS[0].id;

function readHashId(): TocId | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  return TOC_ITEMS.some((item) => item.id === raw) ? (raw as TocId) : null;
}

function scrollToId(id: TocId, behavior: ScrollBehavior) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior, block: "start" });
}

export function useHowItWorksToc() {
  const [activeId, setActiveId] = useState<TocId>(DEFAULT_ID);
  const scrollingRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);

  const navigateTo = useCallback((id: TocId, behavior: ScrollBehavior = "smooth") => {
    scrollingRef.current = true;
    if (scrollTimerRef.current != null) {
      window.clearTimeout(scrollTimerRef.current);
    }
    setActiveId(id);
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.pushState(null, "", url);
    scrollToId(id, behavior);
    scrollTimerRef.current = window.setTimeout(() => {
      scrollingRef.current = false;
      scrollTimerRef.current = null;
    }, 800);
  }, []);

  useEffect(() => {
    const applyHash = (behavior: ScrollBehavior) => {
      const hashId = readHashId();
      if (!hashId) return;
      setActiveId(hashId);
      scrollToId(hashId, behavior);
    };

    // Refresh / deep-link: wait a tick so section ids are in the DOM.
    const frame = window.requestAnimationFrame(() => {
      applyHash("auto");
      window.setTimeout(() => applyHash("auto"), 50);
    });

    const onHashChange = () => applyHash("smooth");
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    const elements = TOC_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top?.target.id) return;
        const id = top.target.id as TocId;
        if (TOC_ITEMS.some((item) => item.id === id)) {
          setActiveId(id);
          const url = `${window.location.pathname}${window.location.search}#${id}`;
          window.history.replaceState(null, "", url);
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { activeId, navigateTo };
}
