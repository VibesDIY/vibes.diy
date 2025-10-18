import React, { useEffect, useMemo, useState } from "react";
import { quickSuggestions } from "../data/quick-suggestions-data.js";

interface QuickSuggestionsProps {
  onSelectSuggestion: (suggestion: string) => void;
}

interface Suggestion {
  label: string;
  text: string;
}

function QuickSuggestions({ onSelectSuggestion }: QuickSuggestionsProps) {
  const [randomSuggestions, setRandomSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allSelected = useMemo(
    () =>
      randomSuggestions.length > 0 &&
      selected.size === randomSuggestions.length,
    [randomSuggestions.length, selected.size],
  );

  const buildCombinedPrompt = (indexes: Set<number>) => {
    const items = Array.from(indexes)
      .sort((a, b) => a - b)
      .map((i) => randomSuggestions[i])
      .filter(Boolean);
    if (items.length === 0) return "";
    // Join selected feature prompts in a concise, model-friendly way
    return items.map((s) => `- ${s.label}: ${s.text}`).join("\n");
  };

  useEffect(() => {
    const shuffled = [...quickSuggestions].sort(() => 0.5 - Math.random());
    setRandomSuggestions(shuffled.slice(0, 8));
  }, []);

  return (
    <div className="mb-8">
      <h3 className="mb-4 text-center text-sm font-medium text-gray-600">
        Create custom vibes from a prompt
      </h3>
      {/* Selection toolbar */}
      {randomSuggestions.length > 0 && (
        <div className="mb-3 flex items-center justify-center gap-4 text-xs text-gray-600">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Select all suggested features"
              checked={allSelected}
              onChange={(e) => {
                const next = new Set<number>();
                if (e.currentTarget.checked) {
                  for (let i = 0; i < randomSuggestions.length; i++)
                    next.add(i);
                }
                setSelected(next);
                const combined = buildCombinedPrompt(next);
                if (combined) onSelectSuggestion(combined);
              }}
              className="h-4 w-4 accent-blue-600"
            />
            <span>Select all</span>
          </label>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                // Clear the input when clearing selection to avoid confusion
                onSelectSuggestion("");
              }}
              className="rounded px-2 py-1 text-[11px] text-blue-700 hover:underline dark:text-blue-400"
            >
              Clear selected
            </button>
          )}
        </div>
      )}

      {/* Suggestions list: checkbox for multi-select + pill button for single insert */}
      <div className="flex flex-wrap justify-center gap-3">
        {randomSuggestions.map((suggestion, index) => {
          const isChecked = selected.has(index);
          return (
            <div key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Select ${suggestion.label}`}
                checked={isChecked}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.currentTarget.checked) next.add(index);
                  else next.delete(index);
                  setSelected(next);
                  const combined = buildCombinedPrompt(next);
                  if (combined) onSelectSuggestion(combined);
                }}
                className="h-4 w-4 accent-blue-600"
              />
              <button
                type="button"
                onClick={() => onSelectSuggestion(suggestion.text)}
                className="cursor-pointer rounded-md bg-light-background-01 px-3 py-1.5 text-sm font-medium text-light-primary transition-colors hover:bg-light-decorative-01 dark:bg-dark-background-01 dark:text-dark-primary dark:hover:bg-dark-decorative-01"
              >
                {suggestion.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QuickSuggestions;
