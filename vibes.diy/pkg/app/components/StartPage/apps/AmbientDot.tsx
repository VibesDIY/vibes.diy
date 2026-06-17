import React, { useRef, useEffect, useCallback } from "react";
import { getAudioContext, createReverb, playTone } from "../audio-helpers.js";

const MIN_FREQ = 220;
const MAX_FREQ = 880;

export default function AmbientDot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const dotPos = useRef({ x: 0.5, y: 0.5 });
  const isDragging = useRef(false);
  const animFrame = useRef<number>(0);

  const getFrequencyFromPosition = useCallback((y: number) => {
    return MAX_FREQ - y * (MAX_FREQ - MIN_FREQ);
  }, []);

  const drawDot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const x = dotPos.current.x * w;
    const y = dotPos.current.y * h;
    const radius = isDragging.current ? 28 : 22;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
    glow.addColorStop(0, "rgba(59, 130, 246, 0.3)");
    glow.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "var(--vibes-near-black, #1a1a1a)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      drawDot();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawDot]);

  const animate = useCallback(() => {
    drawDot();
    animFrame.current = requestAnimationFrame(animate);
  }, [drawDot]);

  useEffect(() => {
    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [animate]);

  const getPosition = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const pos = getPosition(e);
      dotPos.current = pos;
      const ctx = getAudioContext();
      if (!reverbRef.current) {
        reverbRef.current = createReverb(ctx, 3);
      }
      playTone(ctx, getFrequencyFromPosition(pos.y), reverbRef.current, 3);
    },
    [getPosition, getFrequencyFromPosition]
  );

  const handleMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      dotPos.current = getPosition(e);
    },
    [getPosition]
  );

  const handleEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const canvas = canvasRef.current;
      const pos =
        "changedTouches" in e && canvas
          ? {
              x: Math.max(
                0,
                Math.min(
                  1,
                  (e.changedTouches[0].clientX - canvas.getBoundingClientRect().left) / canvas.getBoundingClientRect().width
                )
              ),
              y: Math.max(
                0,
                Math.min(
                  1,
                  (e.changedTouches[0].clientY - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height
                )
              ),
            }
          : dotPos.current;
      dotPos.current = pos;
      const ctx = getAudioContext();
      if (!reverbRef.current) {
        reverbRef.current = createReverb(ctx, 3);
      }
      playTone(ctx, getFrequencyFromPosition(pos.y), reverbRef.current, 4);
    },
    [getFrequencyFromPosition]
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", touchAction: "none", cursor: "pointer" }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
}
