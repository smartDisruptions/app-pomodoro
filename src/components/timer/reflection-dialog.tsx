"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ReflectionDialogProps {
  open: boolean;
  onSubmit: (rating: number | null, note: string | null) => void;
  onSkip: () => void;
}

const ratingEmojis = [
  { value: 1, emoji: "😵", label: "Very distracted" },
  { value: 2, emoji: "😕", label: "Somewhat distracted" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Focused" },
  { value: 5, emoji: "🔥", label: "Deep focus" },
];

export function ReflectionDialog({
  open,
  onSubmit,
  onSkip,
}: ReflectionDialogProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    onSubmit(rating, note.trim() || null);
    setRating(null);
    setNote("");
  };

  const handleSkip = () => {
    onSkip();
    setRating(null);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>How was your focus?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-between gap-1">
            {ratingEmojis.map((r) => (
              <button
                key={r.value}
                onClick={() => setRating(r.value)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md transition-all ${
                  rating === r.value
                    ? "bg-primary/10 scale-110"
                    : "hover:bg-muted"
                }`}
                aria-label={r.label}
                title={r.label}
              >
                <span className="text-2xl">{r.emoji}</span>
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any notes? (optional)"
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={2}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
