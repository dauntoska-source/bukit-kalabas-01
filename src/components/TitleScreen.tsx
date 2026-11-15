import React, { useEffect, useState } from 'react';
import { Play, RotateCcw, Monitor } from 'lucide-react';
import harvestTableImg from '../assets/images/harvest_table_clean_1794755721470.jpg';

interface TitleScreenProps {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  onContinue,
  onNewGame,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (hasSave) onContinue();
        else onNewGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSave, onContinue, onNewGame]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-r from-stone-950/92 via-stone-950/75 to-stone-950/45">
      <div className="max-w-6xl w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12">
        {/* Left: Title Lockup & Menu Buttons Only */}
        <div className="flex-1 min-w-0 space-y-6 text-center md:text-left">
          <div className="inline-block max-w-full">
            <svg
              viewBox="0 0 430 84"
              className="w-72 sm:w-80 lg:w-[25rem] h-auto mx-auto md:mx-0"
              aria-label="Bukit Kalabas"
            >
              <g>
                <path
                  d="M22 66C12 48 18 26 38 16C34 36 38 52 48 66C38 64 28 64 22 66Z"
                  fill="#22C55E"
                />
                <path
                  d="M42 66C48 44 66 28 82 30C68 42 62 54 58 66H42Z"
                  fill="#F59E0B"
                />
                <text
                  x="96"
                  y="56"
                  fill="#FEF3C7"
                  fontFamily="Bricolage Grotesque, system-ui, sans-serif"
                  fontWeight="800"
                  fontSize="44"
                  letterSpacing="-1"
                >
                  Bukit Kalabas
                </text>
              </g>
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            {hasSave ? (
              <>
                <button
                  onClick={onContinue}
                  className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm sm:text-base flex items-center gap-2.5 shadow-lg transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Lanjutkan</span>
                </button>
                <button
                  onClick={onNewGame}
                  className="px-5 py-3.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Mulai Baru</span>
                </button>
              </>
            ) : (
              <button
                onClick={onNewGame}
                className="px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base flex items-center gap-2.5 shadow-lg transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Mulai Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Image-Only Showcase (1.5x enlarged, plain solid nude-green frame) */}
        <div className="w-full max-w-[30rem] sm:max-w-[36rem] md:w-[37.5rem] md:max-w-[58%] lg:max-w-none aspect-[4/3] shrink-0 p-2.5 bg-[#92AA8E]">
          {!imgError ? (
            <img
              src={harvestTableImg}
              alt="Hasil panen padi, kelapa, cabai, kalabas, dan kangkung berkumpul di atas meja di dekat satu set PC"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover block"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-900 text-[#92AA8E]">
              <Monitor className="w-12 h-12" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
