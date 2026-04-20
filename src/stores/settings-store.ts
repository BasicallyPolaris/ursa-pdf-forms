import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutPreference = "figma" | "office";

interface SettingsState {
  layoutPreference: LayoutPreference;
  hasCompletedOnboarding: boolean;
  tourCompleted: boolean;
  tourActive: boolean;
  tourPending: boolean;
  tourStep: number;
  settingsOpen: boolean;
  onboardingOpen: boolean;

  setLayoutPreference: (pref: LayoutPreference) => void;
  completeOnboarding: (pref: LayoutPreference) => void;
  setTourCompleted: (completed: boolean) => void;
  startTour: () => void;
  startTourPending: () => void;
  clearTourPending: () => void;
  endTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  setTourStep: (step: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const TOUR_STEPS = [
  { target: "page-sidebar", key: "sidebar" },
  { target: "properties-panel", key: "properties" },
  { target: "drawing-tools", key: "tools" },
  { target: "export-button", key: "export" },
] as const;

export const TOTAL_TOUR_STEPS = TOUR_STEPS.length;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      layoutPreference: "figma",
      hasCompletedOnboarding: false,
      tourCompleted: false,
      tourActive: false,
      tourPending: false,
      tourStep: 0,
      settingsOpen: false,
      onboardingOpen: false,

      setLayoutPreference: (pref) => set({ layoutPreference: pref }),

      completeOnboarding: (pref) =>
        set({
          hasCompletedOnboarding: true,
          onboardingOpen: false,
          layoutPreference: pref,
        }),

      setTourCompleted: (completed) => set({ tourCompleted: completed }),

      startTour: () => set({ tourActive: true, tourStep: 0, tourPending: false }),

      startTourPending: () => set({ tourPending: true }),

      clearTourPending: () => set({ tourPending: false }),

      endTour: () =>
        set({ tourActive: false, tourStep: 0, tourCompleted: true }),

      nextTourStep: () =>
        set((s) => ({
          tourStep:
            s.tourStep < TOTAL_TOUR_STEPS - 1 ? s.tourStep + 1 : s.tourStep,
        })),

      prevTourStep: () =>
        set((s) => ({
          tourStep: s.tourStep > 0 ? s.tourStep - 1 : s.tourStep,
        })),

      setTourStep: (step) => set({ tourStep: step }),

      openSettings: () => set({ settingsOpen: true }),

      closeSettings: () => set({ settingsOpen: false }),

      openOnboarding: () => set({ onboardingOpen: true }),

      closeOnboarding: () => set({ onboardingOpen: false }),

      resetOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          tourCompleted: false,
          tourActive: false,
          tourPending: false,
          tourStep: 0,
        }),
    }),
    {
      name: "pfm-settings",
      partialize: (state) => ({
        layoutPreference: state.layoutPreference,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        tourCompleted: state.tourCompleted,
      }),
    },
  ),
);
