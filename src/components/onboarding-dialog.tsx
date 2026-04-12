import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutGrid,
  Monitor,
  ArrowRight,
  ArrowLeft,
  Check,
  PanelLeft,
  MousePointerClick,
  FileDown,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayoutPreference } from "@/stores/settings-store";
import { useSettingsStore } from "@/stores/settings-store";

export function OnboardingDialog() {
  const { t } = useTranslation();
  const onboardingOpen = useSettingsStore((s) => s.onboardingOpen);
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const startTour = useSettingsStore((s) => s.startTour);

  const [step, setStep] = useState(0);
  const [selectedLayout, setSelectedLayout] =
    useState<LayoutPreference>("figma");

  if (hasCompletedOnboarding) return null;

  const open = onboardingOpen || !hasCompletedOnboarding;

  function handleFinish() {
    completeOnboarding(selectedLayout);
    startTour();
    setStep(0);
  }

  function handleSkip() {
    completeOnboarding(selectedLayout);
    setStep(0);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleSkip();
      }}
    >
      <DialogBackdrop />
      <DialogContent className="max-w-lg">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle>
              {step === 0 && t("onboarding.welcome.title")}
              {step === 1 && t("onboarding.layout.title")}
              {step === 2 && t("onboarding.ready.title")}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="mt-1.5">
            {step === 0 && t("onboarding.welcome.description")}
            {step === 1 && t("onboarding.layout.description")}
            {step === 2 && t("onboarding.ready.description")}
          </DialogDescription>
        </div>

        <div className="px-6 pb-2">
          {step === 0 && (
            <div className="flex items-center justify-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                <Monitor className="h-8 w-8 text-primary" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 py-4">
              <button
                type="button"
                onClick={() => setSelectedLayout("figma")}
                className={`group flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                  selectedLayout === "figma"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  {selectedLayout === "figma" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div
                  className="mt-2 w-full rounded border border-border bg-muted/30 overflow-hidden"
                  style={{ aspectRatio: "16/10" }}
                >
                  <div className="h-2 w-full border-b border-border bg-card" />
                  <div className="flex h-full">
                    <div className="w-6 border-r border-border bg-card" />
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2">
                      <div className="h-1 w-6 rounded-sm bg-muted-foreground/20" />
                      <div className="h-4 w-8 rounded border border-muted-foreground/20 bg-background" />
                      <div className="mt-1 flex gap-0.5 rounded bg-muted-foreground/10 px-1 py-0.5">
                        <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" />
                        <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" />
                        <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" />
                      </div>
                    </div>
                    <div className="w-6 border-l border-border bg-card" />
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {t("onboarding.layout.figma")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  {t("onboarding.layout.figmaDescription")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLayout("office")}
                className={`group flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                  selectedLayout === "office"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  {selectedLayout === "office" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div
                  className="mt-2 w-full rounded border border-border bg-muted/30 overflow-hidden"
                  style={{ aspectRatio: "16/10" }}
                >
                  <div className="h-2 w-full border-b border-border bg-card">
                    <div className="flex items-center gap-0.5 px-1">
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/20" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/20" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/20" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-primary/40" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/20" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/20" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/20" />
                    </div>
                  </div>
                  <div className="flex h-full">
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2">
                      <div className="h-1 w-6 rounded-sm bg-muted-foreground/20" />
                      <div className="h-4 w-8 rounded border border-muted-foreground/20 bg-background" />
                    </div>
                    <div className="w-6 border-l border-border bg-card" />
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {t("onboarding.layout.office")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  {t("onboarding.layout.officeDescription")}
                </p>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 py-4">
              {[
                {
                  icon: PanelLeft,
                  title: t("onboarding.tour.sidebar"),
                  desc: t("onboarding.tour.sidebarDesc"),
                },
                {
                  icon: MousePointerClick,
                  title: t("onboarding.tour.tools"),
                  desc: t("onboarding.tour.toolsDesc"),
                },
                {
                  icon: FileDown,
                  title: t("onboarding.tour.export"),
                  desc: t("onboarding.tour.exportDesc"),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {title}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("onboarding.skip")}
            </button>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("onboarding.back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (step < 2) {
                  setStep(step + 1);
                } else {
                  handleFinish();
                }
              }}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {step < 2 ? t("onboarding.next") : t("onboarding.getStarted")}
              {step < 2 ? (
                <ArrowRight className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
