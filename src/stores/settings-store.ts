import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserSettings, ThemeOption } from "@/types";

interface SettingsStore extends UserSettings {
  updateSetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => void;
  setTheme: (theme: ThemeOption) => void;
}

const defaults: UserSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  theme: "dark",
  soundEnabled: true,
  notificationsEnabled: false,
  ambientSoundEnabled: false,
  ambientVolume: 0.5,
  reflectionEnabled: true,
  ambientVisualsEnabled: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      updateSetting: (key, value) => set({ [key]: value }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "pomo-settings-v1" }
  )
);
