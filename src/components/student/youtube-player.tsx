"use client";

import { useEffect, useRef } from "react";
import {
  logLessonViewAction,
  pingWatchTimeAction,
} from "@/app/(student)/lessons/actions";

interface Props {
  lessonId: string;
  videoId: string;
}

const PING_INTERVAL_MS = 30_000;

export function YouTubePlayer({ lessonId, videoId }: Props) {
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    logLessonViewAction(lessonId).catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    let lastPing = Date.now();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        lastPing = Date.now();
        return;
      }
      const now = Date.now();
      const delta = Math.round((now - lastPing) / 1000);
      lastPing = now;
      pingWatchTimeAction(lessonId, delta).catch(() => {});
    }, PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [lessonId]);

  const src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-npb-border bg-black">
      <iframe
        src={src}
        title="YouTube player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
