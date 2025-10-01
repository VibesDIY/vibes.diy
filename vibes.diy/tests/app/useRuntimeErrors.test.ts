import { renderHook, act } from "@testing-library/react";
import { useRuntimeErrors } from "~/vibes.diy/app/hooks/useRuntimeErrors.js";
import { vi, describe, test, expect, beforeEach } from "vitest";
import { RuntimeError } from "@vibes.diy/use-vibes-types";

describe("useRuntimeErrors", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to avoid cluttering test output
    vi.spyOn(console, "log").mockImplementation(() => {
      /* no-op */
    });
    vi.spyOn(console, "error").mockImplementation(() => {
      /* no-op */
    });
  });

  test("should initialize with empty error arrays", () => {
    const { result } = renderHook(() => useRuntimeErrors());

    // Verify initial state
    expect(result.current.immediateErrors).toEqual([]);
    expect(result.current.advisoryErrors).toEqual([]);
    expect(typeof result.current.addError).toBe("function");
  });

  test("should categorize syntax error as immediate", async () => {
    const onSaveError = vi.fn();
    const { result } = renderHook(() => useRuntimeErrors({ onSaveError }));

    const syntaxError: RuntimeError = {
      type: "error",
      message: "SyntaxError: Unexpected token",
      timestamp: new Date().toISOString(),
    };

    await act(async () => {
      await result.current.addError(syntaxError);
    });

    // Check that error was added to immediateErrors
    expect(result.current.immediateErrors.length).toBe(1);
    expect(result.current.immediateErrors[0].message).toBe(
      "SyntaxError: Unexpected token",
    );
    expect(result.current.advisoryErrors.length).toBe(0);

    // Verify onSaveError was called with the correct category
    expect(onSaveError).toHaveBeenCalledWith(syntaxError, "immediate");
  });

  test("should categorize database error as advisory", async () => {
    const onSaveError = vi.fn();
    const { result } = renderHook(() => useRuntimeErrors({ onSaveError }));

    const databaseError: RuntimeError = {
      type: "error",
      message: "Not found: database key does not exist",
      timestamp: new Date().toISOString(),
    };

    await act(async () => {
      await result.current.addError(databaseError);
    });

    // Check that error was added to advisoryErrors
    expect(result.current.advisoryErrors.length).toBe(1);
    expect(result.current.advisoryErrors[0].message).toBe(
      "Not found: database key does not exist",
    );
    expect(result.current.immediateErrors.length).toBe(0);

    // Verify onSaveError was called with the correct category
    expect(onSaveError).toHaveBeenCalledWith(databaseError, "advisory");
  });

  test("should automatically assign error type if not provided", async () => {
    const { result } = renderHook(() => useRuntimeErrors());

    const referenceError: RuntimeError = {
      type: "error",
      message: "ReferenceError: x is not defined",
      timestamp: new Date().toISOString(),
    };

    await act(async () => {
      await result.current.addError(referenceError);
    });

    // Verify error type was assigned
    expect(result.current.immediateErrors[0].errorType).toBe("ReferenceError");
  });

  test("should clear immediate errors when didSendErrors is true", async () => {
    // First add an error
    const { result, rerender } = renderHook(
      ({ didSendErrors }) => useRuntimeErrors({ didSendErrors }),
      { initialProps: { didSendErrors: false } },
    );

    const typeError: RuntimeError = {
      type: "error",
      message: "TypeError: Cannot read property",
      timestamp: new Date().toISOString(),
    };

    await act(async () => {
      await result.current.addError(typeError);
    });

    // Verify error was added
    expect(result.current.immediateErrors.length).toBe(1);

    // Now set didSendErrors to true
    rerender({ didSendErrors: true });

    // Errors should be cleared
    expect(result.current.immediateErrors.length).toBe(0);
  });

  test("should handle onSaveError failure gracefully", async () => {
    const onSaveError = vi.fn().mockRejectedValue(new Error("Save failed"));
    const { result } = renderHook(() => useRuntimeErrors({ onSaveError }));

    const syntaxError: RuntimeError = {
      type: "error",
      message: "SyntaxError: Unexpected token",
      timestamp: new Date().toISOString(),
    };

    // This should not throw despite the save error
    await act(async () => {
      await result.current.addError(syntaxError);
    });

    // Error should still be added even though saving failed
    expect(result.current.immediateErrors.length).toBe(1);

    // Console.error should have been called with the save error
    expect(console.error).toHaveBeenCalled();
  });
});
