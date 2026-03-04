import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatInput from "~/vibes.diy/app/components/ChatInput.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Create mock functions we can control
const onSubmit = vi.fn();

describe("ChatInput Component", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("renders without crashing", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} onSubmit={onSubmit} />
      </MockThemeProvider>
    );
    expect(screen.getByPlaceholderText("I want to build...")).toBeDefined();
  });

  it("calls onSubmit when send button is clicked", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} onSubmit={onSubmit} />
      </MockThemeProvider>
    );

    // Must type text before submit — component requires non-empty prompt
    const textArea = screen.getByPlaceholderText("I want to build...");
    fireEvent.change(textArea, { target: { value: "Hello world" } });

    const sendButton = screen.getByLabelText("Send message");
    fireEvent.click(sendButton);

    expect(onSubmit).toHaveBeenCalledWith("Hello world");
  });

  it("disables send button when promptProcessing is true", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={true} onSubmit={onSubmit} />
      </MockThemeProvider>
    );

    const textArea = screen.getByPlaceholderText("Continue coding...");
    const sendButton = screen.getByLabelText("Generating");

    expect(textArea).toBeDisabled();
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit when Enter is pressed", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} onSubmit={onSubmit} />
      </MockThemeProvider>
    );

    const textArea = screen.getByPlaceholderText("I want to build...");
    fireEvent.change(textArea, { target: { value: "Hello world" } });
    fireEvent.keyDown(textArea, { key: "Enter", shiftKey: false });

    expect(onSubmit).toHaveBeenCalledWith("Hello world");
  });

  it("does not call onSubmit when Enter is pressed with Shift", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} onSubmit={onSubmit} />
      </MockThemeProvider>
    );

    const textArea = screen.getByPlaceholderText("I want to build...");
    fireEvent.keyDown(textArea, { key: "Enter", shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not call onSubmit when Enter is pressed while processing", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={true} onSubmit={onSubmit} />
      </MockThemeProvider>
    );

    const textArea = screen.getByPlaceholderText("Continue coding...");
    fireEvent.keyDown(textArea, { key: "Enter", shiftKey: false });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not call onSubmit when button is clicked while processing", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={true} onSubmit={onSubmit} />
      </MockThemeProvider>
    );

    const sendButton = screen.getByLabelText("Generating");
    fireEvent.click(sendButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not render the model picker when models are missing or empty", () => {
    const { rerender } = render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} onSubmit={onSubmit} />
      </MockThemeProvider>
    );
    expect(screen.queryByRole("button", { name: /ai model/i })).toBeNull();

    const emptyModels: {
      id: string;
      name: string;
      description: string;
    }[] = [];
    rerender(
      <MockThemeProvider>
        <ChatInput
          promptProcessing={false}
          onSubmit={onSubmit}
          models={emptyModels}
          onModelChange={vi.fn()}
          showModelPickerInChat
        />
      </MockThemeProvider>
    );
    expect(screen.queryByRole("button", { name: /ai model/i })).toBeNull();
  });

  it("renders the model picker only when showModelPickerInChat is true", () => {
    const models = [
      { id: "a", name: "A", description: "A" },
      { id: "b", name: "B", description: "B" },
    ];

    // Flag false → no picker
    const { rerender } = render(
      <MockThemeProvider>
        <ChatInput
          promptProcessing={false}
          onSubmit={onSubmit}
          models={models}
          onModelChange={vi.fn()}
          showModelPickerInChat={false}
        />
      </MockThemeProvider>
    );
    expect(screen.queryByRole("button", { name: /ai model/i })).toBeNull();

    // Flag true → picker renders
    rerender(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} onSubmit={onSubmit} models={models} onModelChange={vi.fn()} showModelPickerInChat />
      </MockThemeProvider>
    );
    expect(screen.getByRole("button", { name: /ai model/i })).toBeInTheDocument();
  });
});
