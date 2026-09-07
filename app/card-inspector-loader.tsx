"use client";

import { Suspense, lazy, useEffect, useState } from "react";

const CardInspectorBridge = lazy(() => import("./card-inspector"));

/**
 * Keeps the universal Card Inspector out of the initial companion bundle.
 * The heavier card/effect registries and complete-card asset map are loaded
 * only after an existing card modal is opened. This is intentionally generic:
 * future play surfaces can mount CardInspector directly without pulling the
 * Card Library compatibility bridge into their own state model.
 */
export default function CardInspectorLoader() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextActive = Boolean(document.querySelector(".card-modal"));
        document.body.classList.toggle("ddb-card-inspector-active", nextActive);
        setActive(nextActive);
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.body.classList.remove("ddb-card-inspector-active");
    };
  }, []);

  if (!active) return null;
  return <Suspense fallback={null}><CardInspectorBridge /></Suspense>;
}
