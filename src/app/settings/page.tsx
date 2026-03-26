"use client";

import { useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useSessionStore } from "@/stores/session-store";
import { useTaskStore } from "@/stores/task-store";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const settings = useSettingsStore();
  const { updateSetting } = settings;
  const sessions = useSessionStore((s) => s.sessions);
  const dailyStats = useSessionStore((s) => s.dailyStats);
  const clearSessions = useSessionStore((s) => s.clearAll);
  const tasks = useTaskStore((s) => s.tasks);
  const clearTasks = useTaskStore((s) => s.clearAll);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      sessions,
      dailyStats,
      tasks,
      settings: {
        workDuration: settings.workDuration,
        shortBreakDuration: settings.shortBreakDuration,
        longBreakDuration: settings.longBreakDuration,
        sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
        theme: settings.theme,
        soundEnabled: settings.soundEnabled,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pomodoro-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    clearSessions();
    clearTasks();
    setShowClearDialog(false);
  };

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Timer Durations */}
        <section className="space-y-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Timer
          </h2>

          <SettingSlider
            label="Focus Duration"
            value={settings.workDuration}
            min={1}
            max={60}
            unit="min"
            onChange={(v) => updateSetting("workDuration", v)}
          />
          <SettingSlider
            label="Short Break"
            value={settings.shortBreakDuration}
            min={1}
            max={30}
            unit="min"
            onChange={(v) => updateSetting("shortBreakDuration", v)}
          />
          <SettingSlider
            label="Long Break"
            value={settings.longBreakDuration}
            min={1}
            max={60}
            unit="min"
            onChange={(v) => updateSetting("longBreakDuration", v)}
          />
          <SettingSlider
            label="Sessions Before Long Break"
            value={settings.sessionsBeforeLongBreak}
            min={1}
            max={10}
            unit=""
            onChange={(v) => updateSetting("sessionsBeforeLongBreak", v)}
          />
        </section>

        {/* Theme */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Theme
          </h2>
          <div className="flex gap-2">
            {(["dark", "light", "premium"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => updateSetting("theme", theme)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  settings.theme === theme
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Notifications & Sound */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Notifications & Sound
          </h2>

          <SettingToggle
            label="Sound Effects"
            checked={settings.soundEnabled}
            onChange={(v) => updateSetting("soundEnabled", v)}
          />
          <SettingToggle
            label="Browser Notifications"
            checked={settings.notificationsEnabled}
            onChange={(v) => {
              if (v && "Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission().then((perm) => {
                  updateSetting("notificationsEnabled", perm === "granted");
                });
              } else {
                updateSetting("notificationsEnabled", v);
              }
            }}
          />
          <SettingToggle
            label="Session Reflections"
            checked={settings.reflectionEnabled}
            onChange={(v) => updateSetting("reflectionEnabled", v)}
          />
          <SettingToggle
            label="Ambient Sound"
            checked={settings.ambientSoundEnabled}
            onChange={(v) => updateSetting("ambientSoundEnabled", v)}
          />
          {settings.ambientSoundEnabled && (
            <SettingSlider
              label="Ambient Volume"
              value={Math.round(settings.ambientVolume * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => updateSetting("ambientVolume", v / 100)}
            />
          )}
          <SettingToggle
            label="Ambient Visuals"
            checked={settings.ambientVisualsEnabled}
            onChange={(v) => updateSetting("ambientVisualsEnabled", v)}
          />
        </section>

        {/* Data Management */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Data
          </h2>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
          </div>
        </section>

        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear all data?</DialogTitle>
              <DialogDescription>
                This will permanently delete all sessions, tasks, and stats.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setShowClearDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleClearAll}>
                Clear All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SettingSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm text-muted-foreground tabular-nums">
          {value}
          {unit && ` ${unit}`}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(vals) => onChange(Array.isArray(vals) ? vals[0] : vals)}
        aria-label={label}
      />
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
