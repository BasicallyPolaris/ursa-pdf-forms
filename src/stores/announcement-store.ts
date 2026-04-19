import { create } from "zustand";

interface AnnouncementState {
  message: string;
}

export const useAnnouncementStore = create<AnnouncementState>(() => ({
  message: "",
}));

export function announce(message: string) {
  useAnnouncementStore.setState({ message: "" });
  requestAnimationFrame(() => {
    useAnnouncementStore.setState({ message });
  });
}
