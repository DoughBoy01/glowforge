"use client";

import { useEffect, useRef, useState } from "react";

export function IntroVideo() {
  const [visible, setVisible] = useState(true);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.ended) {
      setVisible(false);
      return;
    }
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      setNeedsSoundTap(true);
    });
    const handleEnded = () => setVisible(false);
    const handleError = () => setVisible(false);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    const timeout = setTimeout(() => setVisible(false), 5000);
    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      clearTimeout(timeout);
    };
  }, []);

  const unmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.play();
    setNeedsSoundTap(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={needsSoundTap ? unmute : undefined}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onError={() => setVisible(false)}
      />
      {needsSoundTap && (
        <button
          type="button"
          onClick={unmute}
          className="absolute right-6 bottom-6 mb-safe-b flex min-h-11 items-center rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm"
        >
          Tap for sound
        </button>
      )}
    </div>
  );
}
