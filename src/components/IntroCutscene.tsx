import React, { useEffect, useRef, useState } from 'react';
import { SkipForward, Volume2, VolumeX } from 'lucide-react';

interface IntroCutsceneProps {
  volume: number;
  muted: boolean;
  onFinish: () => void;
}

export const IntroCutscene: React.FC<IntroCutsceneProps> = ({
  volume,
  muted,
  onFinish,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [autoMutedByPolicy, setAutoMutedByPolicy] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const startPlayback = async () => {
      video.volume = Math.max(0, Math.min(1, volume));
      video.muted = muted;
      try {
        await video.play();
        if (!cancelled) {
          setAutoMutedByPolicy(false);
        }
      } catch {
        // Browser blocked unmuted autoplay; fall back to muted autoplay immediately
        try {
          video.muted = true;
          await video.play();
          if (!cancelled) {
            setAutoMutedByPolicy(true);
          }
        } catch {
          // If playback cannot start at all, proceed cleanly to menu
          if (!cancelled) {
            onFinishRef.current();
          }
        }
      }
    };

    startPlayback();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onFinishRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnmuteClick = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = Math.max(0, Math.min(1, volume));
    setAutoMutedByPolicy(false);
    video.play().catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
      onClick={() => {
        if (autoMutedByPolicy) {
          handleUnmuteClick();
        }
      }}
    >
      <video
        ref={videoRef}
        src="/assets/intro_scene.mp4"
        autoPlay
        playsInline
        preload="auto"
        onEnded={onFinish}
        onError={onFinish}
        className="w-full h-full object-contain bg-black"
      />

      <div className="fixed bottom-5 right-5 z-10 flex items-center gap-2.5">
        {autoMutedByPolicy && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUnmuteClick();
            }}
            className="px-4 py-2.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-600 text-stone-100 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg cursor-pointer transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            <span>Aktifkan Suara</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFinish();
          }}
          className="px-4 py-2.5 rounded-xl bg-stone-900/90 hover:bg-amber-500 border border-stone-600 hover:border-amber-400 text-stone-100 hover:text-stone-950 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg cursor-pointer transition-colors"
        >
          <span>Lewati</span>
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
