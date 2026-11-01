"use client";

import type React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

// Local edit: the registry's cubic in/out swapped for the strong curves the rest of the
// video uses, and a shallower flip, so the swap reads as calm rather than mechanical.
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
const FLIP_DEG = 70;

const clampOpts = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export interface RolodexFlipProps {
  items: string[];
  from?: number;
  interval?: number;
  flipDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function RolodexFlip({
  items,
  from = 0,
  interval = 20,
  flipDuration = 10,
  className,
  style,
}: RolodexFlipProps) {
  const frame = useCurrentFrame();
  const sizer = items.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        perspective: 420,
        verticalAlign: "bottom",
        ...style,
      }}
    >
      <span style={{ visibility: "hidden" }}>{sizer}</span>
      {items.map((item, i) => {
        const inStart = from + (i - 1) * interval + flipDuration / 2;
        const outStart = from + i * interval;

        let rotate = 0;
        let y = 0;
        let opacity = 1;

        if (i > 0) {
          const pIn = interpolate(
            frame,
            [inStart, inStart + flipDuration],
            [0, 1],
            { ...clampOpts, easing: easeOut },
          );
          rotate = (1 - pIn) * -FLIP_DEG;
          y = (1 - pIn) * 20;
          opacity = pIn;
        }
        if (i < items.length - 1) {
          const pOut = interpolate(
            frame,
            [outStart, outStart + flipDuration],
            [0, 1],
            { ...clampOpts, easing: easeInOut },
          );
          rotate += pOut * FLIP_DEG;
          y -= pOut * 20;
          opacity *= 1 - pOut;
        }
        if (opacity <= 0.001) return null;

        return (
          <span
            key={`${i}-${item}`}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              whiteSpace: "nowrap",
              opacity,
              transform: `translateY(${y}px) rotateX(${rotate}deg)`,
              transformOrigin: "50% 50%",
              backfaceVisibility: "hidden",
            }}
          >
            {item}
          </span>
        );
      })}
    </span>
  );
}
