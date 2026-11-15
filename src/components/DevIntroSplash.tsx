import React, { useEffect, useRef, useState } from 'react';
import { Music, SkipForward, Volume2 } from 'lucide-react';
import { soundEngine } from '../utils/audio';

interface DevIntroSplashProps {
  onFinish: () => void;
}

type SplashStage =
  | 'INIT'
  | 'FLY_IN'
  | 'STAY'
  | 'FLY_OUT'
  | 'TEXT_SHOW'
  | 'FADE_EXIT';

export const DevIntroSplash: React.FC<DevIntroSplashProps> = ({ onFinish }) => {
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [stage, setStage] = useState<SplashStage>('INIT');
  const [audioNeedsGesture, setAudioNeedsGesture] = useState(false);

  useEffect(() => {
    // Start traditional Javanese agricultural instrumental (Suling, Gender, Lesung, Gong)
    const started = soundEngine.startJavaneseIntroMusic();
    setAudioNeedsGesture(!started && soundEngine.isAudioContextBlocked());

    const unlockAudio = () => {
      const ok = soundEngine.startJavaneseIntroMusic();
      if (ok || !soundEngine.isAudioContextBlocked()) {
        setAudioNeedsGesture(false);
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });

    // Cinematic timeline:
    // 0.05s - 1.25s : Fly in from bottom to center
    // 1.25s - 6.25s : Stay 5 seconds at center
    // 6.25s - 7.35s : Fly upward & vanish
    // 7.35s - 12.25s: Elegant Javanese-framed disclaimer text
    // 12.25s - 12.95s: Smooth fade out -> enter merged video scene
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage('FLY_IN'), 40));
    timers.push(window.setTimeout(() => setStage('STAY'), 1250));
    timers.push(window.setTimeout(() => setStage('FLY_OUT'), 6250));
    timers.push(window.setTimeout(() => setStage('TEXT_SHOW'), 7350));
    timers.push(window.setTimeout(() => setStage('FADE_EXIT'), 12250));
    timers.push(
      window.setTimeout(() => {
        soundEngine.stopJavaneseIntroMusic();
        onFinishRef.current();
      }, 12950)
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        soundEngine.stopJavaneseIntroMusic();
        onFinishRef.current();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', onKey);
      soundEngine.stopJavaneseIntroMusic();
    };
  }, []);

  const showLogo = stage === 'INIT' || stage === 'FLY_IN' || stage === 'STAY' || stage === 'FLY_OUT';
  const showText = stage === 'TEXT_SHOW' || stage === 'FADE_EXIT';

  const logoTransformClass =
    stage === 'INIT'
      ? 'translate-y-[62vh] scale-75 opacity-0'
      : stage === 'FLY_IN' || stage === 'STAY'
      ? 'translate-y-0 scale-100 opacity-100'
      : ' -translate-y-[64vh] scale-90 opacity-0';

  const logoTransitionClass =
    stage === 'FLY_OUT'
      ? 'transition-all duration-[1050ms] ease-[cubic-bezier(0.7,0,0.84,0)]'
      : 'transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]';

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-stone-950 flex items-center justify-center p-6 transition-opacity duration-700 ${
        stage === 'FADE_EXIT' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Subtle cinematic misty emerald-amber atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(13,148,136,0.16)_0%,rgba(28,25,23,0.92)_58%,rgba(12,10,9,1)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Stage 1-3: Developer Logo Flying From Bottom -> Center (Stay 5s) -> Top & Vanish */}
      {showLogo && (
        <div
          className={`relative z-10 flex flex-col items-center justify-center ${logoTransitionClass} ${logoTransformClass}`}
        >
          {/* Luminous soft backdrop aura behind transparent RGBA logo */}
          <div className="relative flex items-center justify-center p-7 sm:p-9 rounded-3xl bg-stone-100/95 shadow-[0_0_90px_rgba(20,184,166,0.35)] border border-teal-300/40">
            <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-teal-400/15 blur-2xl" />
            <img
              src="/assets/aistudio/dt_logo-a02_127a11dd.png"
              alt="Logo Developer Game"
              className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-md"
            />
          </div>

          <div
            className={`mt-5 flex items-center gap-2 text-xs tracking-[0.28em] uppercase text-teal-200/80 font-medium transition-opacity duration-700 ${
              stage === 'STAY' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="w-6 h-px bg-teal-400/50" />
            <span>Mempersembahkan</span>
            <span className="w-6 h-px bg-teal-400/50" />
          </div>
        </div>
      )}

      {/* Stage 4: Clean, Aesthetic Disclaimer Notice */}
      {showText && (
        <div
          className={`relative z-10 max-w-xl w-full text-center px-6 py-8 sm:px-10 sm:py-10 rounded-3xl bg-stone-900/75 border border-amber-500/25 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all duration-700 ${
            stage === 'TEXT_SHOW' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
          }`}
        >
          {/* Delicate Javanese golden ornament divider */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="w-12 h-px bg-gradient-to-r from-transparent to-amber-400/70" />
            <Music className="w-4 h-4 text-amber-400/85" />
            <span className="w-12 h-px bg-gradient-to-l from-transparent to-amber-400/70" />
          </div>

          <p className="font-display text-xl sm:text-2xl font-bold text-amber-200 tracking-tight leading-snug">
            Ini hanya permainan, <span className="text-teal-300 italic font-semibold">just for fun</span>.
          </p>

          <p className="mt-3.5 text-sm sm:text-base text-stone-200/90 leading-relaxed font-normal max-w-md mx-auto">
            Jangan terlalu dianggap serius, apalagi sampai menghabiskan waktu di dalam game ini.
          </p>

          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <span className="w-16 h-px bg-stone-700" />
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400/60" />
          </div>
        </div>
      )}

      {/* Bottom Controls: Audio Unlock (only if browser blocked autoplay) & Skip */}
      <div className="fixed bottom-5 right-5 z-20 flex items-center gap-2.5">
        {audioNeedsGesture && (
          <button
            type="button"
            onClick={() => {
              soundEngine.startJavaneseIntroMusic();
              setAudioNeedsGesture(false);
            }}
            className="px-4 py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-2 shadow-lg cursor-pointer transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Putar Musik Jawa</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            soundEngine.stopJavaneseIntroMusic();
            onFinishRef.current();
          }}
          className="px-4 py-2 rounded-xl bg-stone-900/85 hover:bg-amber-500 border border-stone-700 hover:border-amber-400 text-stone-300 hover:text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transition-colors"
        >
          <span>Lewati</span>
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
