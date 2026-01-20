/**
 * Helper type for transform functions
 */
type TransformFn<I, O> = (
  msg: I,
  controller: TransformStreamDefaultController<O>
) => void | Promise<void>;

/**
 * Creates a transform function that passes through all input messages
 * before calling the provided handler for additional processing.
 *
 * @example
 * ```typescript
 * new TransformStream({
 *   transform: passthrough((msg, controller) => {
 *     if (isBlockImage(msg)) {
 *       controller.enqueue({ type: "image.begin", ... });
 *     }
 *   })
 * });
 * ```
 */
export function passthrough<I, O>(fn: TransformFn<I, O>): TransformFn<I, O> {
  return (msg, controller) => {
    controller.enqueue(msg as unknown as O);
    return fn(msg, controller);
  };
}
