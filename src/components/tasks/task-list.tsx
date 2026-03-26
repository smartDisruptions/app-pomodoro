"use client";

import { useState } from "react";
import { useTaskStore } from "@/stores/task-store";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskList() {
  const { tasks, selectedTaskId, addTask, deleteTask, selectTask } =
    useTaskStore();
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    addTask(trimmed);
    setInput("");
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a focus task..."
          className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="New task title"
        />
        <Button type="submit" size="sm" disabled={!input.trim()}>
          Add
        </Button>
      </form>

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No tasks yet. Add one to track focus sessions.
        </p>
      )}

      <ul className="space-y-1">
        {tasks.map((task) => {
          const isSelected = task.id === selectedTaskId;
          return (
            <li
              key={task.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors duration-150",
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted border border-transparent"
              )}
              onClick={() => selectTask(isSelected ? null : task.id)}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                )}
              >
                {isSelected && <Check className="w-3 h-3" />}
              </div>
              <span className="flex-1 truncate">{task.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {task.completedSessions}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTask(task.id);
                }}
                aria-label={`Delete task: ${task.title}`}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
