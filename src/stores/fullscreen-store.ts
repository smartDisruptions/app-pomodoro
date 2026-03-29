import { create } from "zustand";

interface FullscreenStore {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
}

export const useFullscreenStore = create<FullscreenStore>((set) => ({
  isFullscreen: false,
  setFullscreen: (value) => set({ isFullscreen: value }),
}));
