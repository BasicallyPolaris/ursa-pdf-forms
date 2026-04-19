import {
  TOUR_STEPS,
  TOTAL_TOUR_STEPS,
  useSettingsStore,
} from "@/stores/settings-store";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface SpotlightRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function TourSpotlight() {
  const { t } = useTranslation();
  const tourActive = useSettingsStore((s) => s.tourActive);
  const tourStep = useSettingsStore((s) => s.tourStep);
  const endTour = useSettingsStore((s) => s.endTour);
  const nextTourStep = useSettingsStore((s) => s.nextTourStep);
  const prevTourStep = useSettingsStore((s) => s.prevTourStep);

  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<
    "top" | "bottom" | "left" | "right"
  >("bottom");
  const rafRef = useRef<number>(0);
  const prevRectRef = useRef<SpotlightRect | null>(null);
  const prevTooltipPosRef = useRef<string>("bottom");
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleTrapKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const container = tooltipRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!tourActive) return;
    document.addEventListener("keydown", handleTrapKeyDown);
    const firstBtn = tooltipRef.current?.querySelector<HTMLElement>("button");
    firstBtn?.focus();
    return () => document.removeEventListener("keydown", handleTrapKeyDown);
  }, [tourActive, tourStep, handleTrapKeyDown]);

  useEffect(() => {
    if (!tourActive) return;

    function update() {
      const stepDef = TOUR_STEPS[tourStep];
      if (!stepDef) return;
      const el = document.querySelector(`[data-tour="${stepDef.target}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next: SpotlightRect = {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };

      const prev = prevRectRef.current;
      const rectChanged =
        !prev ||
        prev.top !== next.top ||
        prev.left !== next.left ||
        prev.right !== next.right ||
        prev.bottom !== next.bottom ||
        prev.width !== next.width ||
        prev.height !== next.height;
      if (rectChanged) {
        prevRectRef.current = next;
        setRect(next);
      }

      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const spaceBelow = vh - next.bottom;
      const spaceAbove = next.top;
      const spaceRight = vw - next.right;
      const spaceLeft = next.left;

      let pos: "top" | "bottom" | "left" | "right";
      if (spaceBelow > 120) pos = "bottom";
      else if (spaceAbove > 120) pos = "top";
      else if (spaceRight > 200) pos = "right";
      else if (spaceLeft > 200) pos = "left";
      else pos = "bottom";

      if (prevTooltipPosRef.current !== pos) {
        prevTooltipPosRef.current = pos;
        setTooltipPos(pos);
      }
    }

    update();
    rafRef.current = requestAnimationFrame(function loop() {
      update();
      rafRef.current = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [tourActive, tourStep]);

  if (!tourActive || !rect) return null;

  const PAD = 6;
  const stepInfo = TOUR_STEPS[tourStep];
  const r = rect;

  function getTooltipStyle(): React.CSSProperties {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = 256;
    const estTh = 120;
    const margin = 8;

    switch (tooltipPos) {
      case "bottom": {
        const center = r.left + r.width / 2;
        const clamped = Math.max(margin + tw / 2, Math.min(center, vw - margin - tw / 2));
        return {
          top: r.bottom + PAD + 8,
          left: clamped,
          transform: "translateX(-50%)",
        };
      }
      case "top": {
        const center = r.left + r.width / 2;
        const clamped = Math.max(margin + tw / 2, Math.min(center, vw - margin - tw / 2));
        return {
          bottom: vh - r.top + PAD + 8,
          left: clamped,
          transform: "translateX(-50%)",
        };
      }
      case "right": {
        const midY = r.top + r.height / 2;
        const clamped = Math.max(margin, Math.min(midY - estTh / 2, vh - margin - estTh));
        return {
          top: clamped,
          left: r.right + PAD + 8,
        };
      }
      case "left": {
        const midY = r.top + r.height / 2;
        const clamped = Math.max(margin, Math.min(midY - estTh / 2, vh - margin - estTh));
        return {
          top: clamped,
          right: vw - r.left + PAD + 8,
        };
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100]" data-tour-overlay>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={r.left - PAD}
              y={r.top - PAD}
              width={r.width + PAD * 2}
              height={r.height + PAD * 2}
              rx="6"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.4)"
          mask="url(#tour-hole)"
        />
        <rect
          x={r.left - PAD}
          y={r.top - PAD}
          width={r.width + PAD * 2}
          height={r.height + PAD * 2}
          rx="6"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          className="opacity-80"
        />
      </svg>

      <div
        ref={tooltipRef}
        className="absolute z-[101] w-64 rounded-lg border border-border bg-popover p-3 shadow-xl"
        style={getTooltipStyle()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-foreground">
            {t(`onboarding.tour.${stepInfo.key}Title`)}
          </p>
           <button
             type="button"
             onClick={endTour}
             aria-label={t("onboarding.closeTour")}
             className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
           >
            <X className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {t(`onboarding.tour.${stepInfo.key}Desc`)}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {tourStep + 1} / {TOTAL_TOUR_STEPS}
          </span>
          <div className="flex items-center gap-1">
            {tourStep > 0 && (
              <button
                type="button"
                onClick={prevTourStep}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-2.5 w-2.5" />
                {t("onboarding.back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (tourStep < TOTAL_TOUR_STEPS - 1) nextTourStep();
                else endTour();
              }}
              className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {tourStep < TOTAL_TOUR_STEPS - 1
                ? t("onboarding.next")
                : t("onboarding.done")}
              {tourStep < TOTAL_TOUR_STEPS - 1 ? (
                <ArrowRight className="h-2.5 w-2.5" />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
