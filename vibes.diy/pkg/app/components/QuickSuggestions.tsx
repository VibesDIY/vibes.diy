import React, { useEffect, useState } from "react";
import { quickSuggestions } from "../data/quick-suggestions-data.js";
// TODO save to evalute using this on the new home page, after it is merged
interface QuickSuggestionsProps {
  onSelectSuggestion: (suggestion: string) => void;
}

interface Suggestion {
  label: string;
  text: string;
}

function QuickSuggestions({ onSelectSuggestion }: QuickSuggestionsProps) {
  const [randomSuggestions, setRandomSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const shuffled = [...quickSuggestions].sort(() => 0.5 - Math.random());
    setRandomSuggestions(shuffled.slice(0, 8));
  }, []);

  return (
    <div className="mb-8">
      <h3 className="mb-4 text-center text-sm font-medium text-gray-600">
        Create custom vibes from a prompt
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {randomSuggestions.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelectSuggestion(suggestion.text)}
            className="cursor-pointer rounded-md bg-light-background-01 px-3 py-1.5 text-sm font-medium text-light-primary transition-colors hover:bg-light-decorative-01 dark:bg-dark-background-01 dark:text-dark-primary dark:hover:bg-dark-decorative-01"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickSuggestions;
