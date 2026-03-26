"use client";

import { Button } from "@/components/ui/button";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import type { TimerState } from "@/types";

interface TimerControlsProps {
  state: TimerState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function TimerControls({
  state,
  onStart,
  onPause,
  onResume,
  onSkip,
  onReset,
}: TimerControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {state === "idle" && (
        <Button
          size="lg"
          onClick={onStart}
          aria-label="Start timer"
          className="px-8 transition-transform duration-150 active:scale-95"
        >
          <Play className="h-5 w-5 mr-2" />
          Start
        </Button>
      )}

      {state === "running" && (
        <Button
          size="lg"
          onClick={onPause}
          aria-label="Pause timer"
          className="px-8 transition-transform duration-150 active:scale-95"
        >
          <Pause className="h-5 w-5 mr-2" />
          Pause
        </Button>
      )}

      {state === "paused" && (
        <Button
          size="lg"
          onClick={onResume}
          aria-label="Resume timer"
          className="px-8 transition-transform duration-150 active:scale-95"
        >
          <Play className="h-5 w-5 mr-2" />
          Resume
        </Button>
      )}

      {state === "completed" && (
        <Button
          size="lg"
          onClick={onSkip}
          aria-label="Continue to next session"
          className="px-8 transition-transform duration-150 active:scale-95"
        >
          <SkipForward className="h-5 w-5 mr-2" />
          Continue
        </Button>
      )}

      {(state === "running" || state === "paused") && (
        <>
          <Button
            size="lg"
            variant="secondary"
            onClick={onSkip}
            aria-label="Skip to next session"
            className="transition-transform duration-150 active:scale-95"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={onReset}
            aria-label="Reset timer"
            className="transition-transform duration-150 active:scale-95"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  );
}
