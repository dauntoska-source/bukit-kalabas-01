import React, { useState } from 'react';
import {
  ArrowLeft,
  Award,
  BedDouble,
  Bot,
  CheckCircle2,
  CloudRain,
  Coffee,
  Droplets,
  KeyRound,
  Lock,
  Moon,
  Music,
  Play,
  RotateCcw,
  Save,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ITEMS, SEASONS, WEATHER_LABELS } from '../data/cropsAndItems';
import { DaySummaryData, InventorySlot, PlayerStats } from '../types/game';
import { soundEngine } from '../utils/audio';
import { ItemIcon } from './ItemIcon';

interface PauseModalProps {
  muted: boolean;
  volume: number;
  musicVolume: number;
  onChangeVolume: (vol: number) => void;
  onChangeMusicVolume: (vol: number) => void;
  onToggleMute: () => void;
  onRedeemCode: (rawCode: string) => { ok: boolean; message: string };
  onResume: () => void;
  onSaveNow: () => void;
  onExitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  muted,
  volume,
  musicVolume,
  onChangeVolume,
  onChangeMusicVolume,
  onToggleMute,
  onRedeemCode,
  onResume,
  onSaveNow,
  onExitToTitle,
}) => {
  const [view, setView] = useState<'MAIN' | 'VOLUME' | 'CODE'>('MAIN');
  const [codeInput, setCodeInput] = useState<string>('');
  const [codeFeedback, setCodeFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const volumePct = Math.round(volume * 100);
  const musicPct = Math.round(musicVolume * 100);
  const effectiveMusicPctOfSfx = Math.round(volume * musicVolume * 80);

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) {
      setCodeFeedback({ ok: false, message: 'Masukkan kode terlebih dahulu.' });
      return;
    }
    const res = onRedeemCode(codeInput);
    setCodeFeedback(res);
    if (res.ok) {
      setCodeInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {view === 'MAIN' && (
          <>
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-100">Permainan Dijeda</h2>
              <p className="text-xs text-stone-400 mt-1">
                1 hari game = 9 menit waktu nyata · Tidur maksimal pukul 00:00 di kamar tidur
              </p>
            </div>

            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 text-xs text-stone-300 space-y-1.5">
              <div><strong className="text-amber-300">Berjalan:</strong> Klik / Tap di tanah, atau tahan &amp; geser pointer</div>
              <div><strong className="text-amber-300">Bertani &amp; Menebang:</strong> Klik petak tanah, tanaman, pohon, atau hasil hutan</div>
              <div><strong className="text-amber-300">Interaksi:</strong> Klik langsung Pintu, PC, Tempat Tidur, Dapur, Kulkas, Lemari, WC, Kolam Mandi, atau Sumur</div>
              <div><strong className="text-amber-300">Peta Dunia:</strong> Kanan = Hutan · Atas = Kebun Atas (1 Juta EG)</div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={onResume}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Lanjutkan</span>
              </button>

              <button
                onClick={() => setView('VOLUME')}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-sky-400" />
                <span>Pengaturan Volume</span>
              </button>

              <button
                onClick={() => {
                  setCodeFeedback(null);
                  setView('CODE');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Masukkan Kode</span>
              </button>

              <button
                onClick={onSaveNow}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Simpan Progres</span>
              </button>

              <button
                onClick={onExitToTitle}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Kembali ke Layar Judul</span>
              </button>
            </div>
          </>
        )}

        {view === 'VOLUME' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setView('MAIN')}
                  className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
                  aria-label="Kembali"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-display text-lg font-bold text-stone-100">Pengaturan Volume</h2>
                  <p className="text-xs text-stone-400">Atur suara efek permainan &amp; musik latar</p>
                </div>
              </div>
              <button
                onClick={onResume}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer"
              >
                Selesai
              </button>
            </div>

            <div className="space-y-3">
              {/* Sound Effects Volume */}
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
                    {muted || volumePct === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-sky-400" />
                    )}
                    <span>Volume Sound Efek</span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-amber-300">
                    {muted ? 'Bisukan' : volumePct === 100 ? '100% · Maksimal' : `${volumePct}%`}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={muted ? 0 : volumePct}
                  onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                  className="w-full accent-amber-500 cursor-pointer"
                  aria-label="Pengatur Volume Sound Efek"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onChangeVolume(1);
                      soundEngine.playTestSound();
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer"
                  >
                    Maksimal (100%)
                  </button>
                  <button
                    onClick={() => soundEngine.playTestSound()}
                    className="py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Tes Efek
                  </button>
                </div>
              </div>

              {/* Background Music Volume (Max 80% of Sound Effects) */}
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
                    <Music className="w-4 h-4 text-emerald-400" />
                    <span>Volume Musik Latar</span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-emerald-300">
                    {muted || volumePct === 0
                      ? 'Bisukan'
                      : `${musicPct}% (${effectiveMusicPctOfSfx}% SFX)`}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={muted ? 0 : musicPct}
                  onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
                  className="w-full accent-emerald-500 cursor-pointer"
                  aria-label="Pengatur Volume Musik Latar"
                />

                <div className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
                  <span>Batas maksimal musik: 80% dari volume sound efek</span>
                  <button
                    onClick={() => onChangeMusicVolume(1)}
                    className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold shrink-0 cursor-pointer"
                  >
                    Maks (80%)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleMute}
                  className="flex-1 py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  {muted ? 'Nyalakan Semua Suara' : 'Bisukan Semua'}
                </button>
                <button
                  onClick={() => {
                    onChangeVolume(1);
                    onChangeMusicVolume(1);
                    soundEngine.playTestSound();
                  }}
                  className="flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer"
                >
                  Maksimal Semua
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'CODE' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setView('MAIN')}
                  className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
                  aria-label="Kembali"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-display text-lg font-bold text-stone-100">Masukkan Kode</h2>
                  <p className="text-xs text-stone-400">Tukarkan kode hadiah level atau uang game</p>
                </div>
              </div>
              <button
                onClick={onResume}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer"
              >
                Selesai
              </button>
            </div>

            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Penukaran Kode Hadiah</span>
              </div>

              <form onSubmit={handleSubmitCode} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs text-stone-400">Ketik kode hadiah Anda:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="Masukkan kode..."
                      className="flex-1 bg-stone-900 border border-stone-700 focus:border-amber-400 rounded-lg px-3 py-2.5 text-sm font-mono-num tracking-wider text-stone-100 placeholder:text-stone-500 outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Gunakan
                    </button>
                  </div>
                </div>

                {codeFeedback && (
                  <div
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      codeFeedback.ok
                        ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {codeFeedback.message}
                  </div>
                )}
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface DaySummaryModalProps {
  summary: DaySummaryData;
  onNextDay: () => void;
}

export const DaySummaryModal: React.FC<DaySummaryModalProps> = ({ summary, onNextDay }) => {
  return (
    <div className="fixed inset-0 z-40 bg-stone-950/90 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-stone-100">
              {summary.fainted ? 'Pingsan Lewat Pukul 00:00!' : 'Istirahat Malam Selesai'}
            </h2>
            <p className="text-xs text-stone-400">
              {SEASONS[summary.prevSeason].name} Hari {summary.prevDay} → {SEASONS[summary.nextSeason].name} Hari {summary.nextDay}
            </p>
          </div>
        </div>

        <div className="bg-sky-950/50 border border-sky-500/35 rounded-xl p-3 text-xs text-sky-100 leading-relaxed">
          Anda bangun di <strong>Kamar Tidur</strong> dengan <strong>Health 50 · Mood 50 · Speed 50</strong>. Pesan <strong>Sarapan Online</strong> di PC, gunakan <strong>WC pagi</strong> (+10 Health/Mood/Speed), dan berendam di Kamar Mandi (+20 Health, +15 Mood, +10 Speed).
        </div>

        {summary.fainted && (
          <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200">
            Anda terjaga melewati batas pukul 00:00 sehingga kelelahan
            {summary.faintPenalty > 0 ? ` dan biaya pemulihan ${summary.faintPenalty} EG dikenakan.` : '.'}
          </div>
        )}

        {summary.seasonChanged && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200">
            <strong>Pergantian Musim!</strong> Selamat datang di musim <strong>{SEASONS[summary.nextSeason].name}</strong> ({SEASONS[summary.nextSeason].subtitle}). Kunjungi PC untuk membeli bibit musim baru!
          </div>
        )}

        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2 text-xs text-stone-300">
          <div className="flex justify-between">
            <span>Cuaca Hari Baru:</span>
            <span className="font-semibold text-sky-300">
              {WEATHER_LABELS[summary.weatherNext].label} ({summary.rainfallMm} mm)
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tanaman Bertumbuh:</span>
            <span className="font-mono-num font-semibold text-emerald-400">{summary.cropsGrown} petak</span>
          </div>
          {summary.rainWateredCount > 0 && (
            <div className="flex justify-between">
              <span>Disiram Hujan Otomatis:</span>
              <span className="font-mono-num font-semibold text-sky-400">{summary.rainWateredCount} petak</span>
            </div>
          )}
          {summary.wiltedCount > 0 && (
            <div className="flex justify-between">
              <span>Layu (Kekeringan / Ganti Musim):</span>
              <span className="font-mono-num font-semibold text-rose-400">{summary.wiltedCount} petak</span>
            </div>
          )}
        </div>

        <button
          onClick={onNextDay}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm cursor-pointer"
        >
          Bangun Pagi (06:00)
        </button>
      </div>
    </div>
  );
};

interface SleepConfirmModalProps {
  timeMinutes: number;
  onConfirmSleep: () => void;
  onCancel: () => void;
}

export const SleepConfirmModal: React.FC<SleepConfirmModalProps> = ({
  timeMinutes,
  onConfirmSleep,
  onCancel,
}) => {
  const clamped = Math.min(1440, Math.max(360, Math.floor(timeMinutes)));
  const hh = Math.floor(clamped / 60) % 24;
  const mm = Math.floor((clamped % 60) / 10) * 10;
  const timeText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-sm bg-stone-900 border border-stone-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <BedDouble className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-stone-100 leading-snug">
              Konfirmasi Tidur
            </h2>
            <p className="text-xs text-stone-400 font-mono-num">
              Waktu saat ini: {timeText} · Batas tidur 00:00
            </p>
          </div>
        </div>

        <p className="text-sm text-stone-200 leading-relaxed">
          Apakah Anda mau tidur dan mengakhiri hari ini?
        </p>

        <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-400 leading-relaxed">
          Progres akan disimpan, tanaman yang sudah disiram akan bertumbuh, dan Anda akan bangun besok pagi pukul 06:00.
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            Belum
          </button>
          <button
            onClick={onConfirmSleep}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
          >
            Ya, Tidur
          </button>
        </div>
      </div>
    </div>
  );
};

interface RobotRecruitModalProps {
  playerLevel: number;
  kalabasCount: number;
  gold: number;
  robotOwned: boolean;
  onRecruit: () => void;
  onClose: () => void;
}

export const RobotRecruitModal: React.FC<RobotRecruitModalProps> = ({
  playerLevel,
  kalabasCount,
  gold,
  robotOwned,
  onRecruit,
  onClose,
}) => {
  const levelOk = playerLevel >= 7;
  const kalabasOk = kalabasCount >= 100;
  const goldOk = gold >= 1_000_000;
  const canRecruit = !robotOwned && levelOk && kalabasOk && goldOk;

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-900/40 border border-amber-600/40 flex items-center justify-center text-amber-400 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-stone-100 leading-snug">
              Robot Mecha Laboratorium
            </h2>
            <p className="text-xs text-stone-400">
              {robotOwned
                ? 'Sudah menjadi rekan & penjaga kebunmu'
                : 'Mecha penjaga Lab Kalabas (HP reset pukul 03:00 pagi)'}
            </p>
          </div>
        </div>

        {robotOwned ? (
          <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-4 space-y-2 text-xs text-emerald-200 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
              <Award className="w-4 h-4" />
              <span>Robot Mecha Penjaga Resmi Milikmu!</span>
            </div>
            <p>
              Robot mecha kini menjaga Kebun Utama dan otomatis menyiram seluruh petak tanaman yang sudah dicangkul setiap pagi.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-300 leading-relaxed">
              Robot mecha ini berdiri di depan Lab Penelitian di utara Kebun Atas. Tiap 2 hari sekali buah kalabas di sekitar lab jatuh sebanyak 1 pcs, dan hanya separo pohon kalabas berbuah secara acak tiap 3 hari sekali. Penuhi syarat berikut untuk memilikinya:
            </p>

            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-300">1. Level Player Minimal 7</span>
                <span className={`font-mono-num font-bold flex items-center gap-1.5 ${levelOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {levelOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  Lv.{playerLevel} / 7
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-300">2. Berikan 100 pcs Buah Kalabas</span>
                <span className={`font-mono-num font-bold flex items-center gap-1.5 ${kalabasOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {kalabasOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {kalabasCount} / 100 pcs
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-300">3. Biaya Perbaikan 1.000.000 EG</span>
                <span className={`font-mono-num font-bold flex items-center gap-1.5 ${goldOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {goldOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {gold.toLocaleString('id-ID')} / 1.000.000 EG
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            Tutup
          </button>
          {!robotOwned && (
            <button
              onClick={onRecruit}
              disabled={!canRecruit}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Miliki Robot
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface KitchenModalProps {
  homeEatUsedToday: number;
  homeDrinkUsedToday: number;
  stats: PlayerStats;
  inventory: InventorySlot[];
  onHomeWater: () => void;
  onHomeTea: () => void;
  onHomeMeal: () => void;
  onConsumeInventoryItem: (itemId: string) => void;
  onClose: () => void;
}

export const KitchenModal: React.FC<KitchenModalProps> = ({
  homeEatUsedToday,
  homeDrinkUsedToday,
  stats,
  inventory,
  onHomeWater,
  onHomeTea,
  onHomeMeal,
  onConsumeInventoryItem,
  onClose,
}) => {
  const edibleSlots = inventory.filter((slot) => {
    const def = ITEMS[slot.itemId];
    if (!def || def.id === 'buah_kalabas') return false;
    return (
      (def.restoreHealth ?? 0) > 0 ||
      (def.restoreMood ?? 0) > 0 ||
      (def.boostSpeed ?? 0) > 0
    );
  });

  const teaRemaining = Math.max(0, 2 - homeDrinkUsedToday);
  const mealRemaining = Math.max(0, 1 - homeEatUsedToday);

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-100 leading-snug">
                Dapur Nusantara (Di Dalam Rumah)
              </h2>
              <p className="text-xs text-stone-400">
                Makan &amp; minum di rumah · Health {Math.round(stats.health)} · Mood {Math.round(stats.mood)} · Speed {Math.round(stats.speed)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Hidangan Dapur Rumah (Gratis)
          </div>

          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <Droplets className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-100">Air Putih Segar Dapur</div>
                <div className="text-xs text-sky-300">+8 Health · +6 Mood · +8 Speed (Tanpa batas)</div>
              </div>
            </div>
            <button
              onClick={onHomeWater}
              className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              Minum
            </button>
          </div>

          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-100">
                  Teh Hangat Nusantara{' '}
                  <span className="font-mono-num text-xs text-stone-400">(Sisa {teaRemaining}/2 hari ini)</span>
                </div>
                <div className="text-xs text-emerald-300">+18 Health · +18 Mood · +14 Speed</div>
              </div>
            </div>
            <button
              onClick={onHomeTea}
              disabled={teaRemaining <= 0}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-bold text-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              Minum
            </button>
          </div>

          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Utensils className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-100">
                  Masakan Hangat Dapur{' '}
                  <span className="font-mono-num text-xs text-stone-400">(Sisa {mealRemaining}/1 hari ini)</span>
                </div>
                <div className="text-xs text-amber-300">+35 Health · +25 Mood · +15 Speed</div>
              </div>
            </div>
            <button
              onClick={onHomeMeal}
              disabled={mealRemaining <= 0}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold text-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              Makan
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Makan &amp; Minum dari Tas (Buah &amp; Bekal)
          </div>
          {edibleSlots.length === 0 ? (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 text-xs text-stone-400">
              Tidak ada makanan/minuman layak konsumsi di dalam tas. (Buah Kalabas tidak dapat dimakan.)
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {edibleSlots.map((slot) => {
                const def = ITEMS[slot.itemId];
                if (!def) return null;
                const effects: string[] = [];
                if (def.restoreHealth) effects.push(`+${def.restoreHealth} Health`);
                if (def.restoreMood) effects.push(`+${def.restoreMood} Mood`);
                if (def.boostSpeed) effects.push(`+${def.boostSpeed} Speed`);
                return (
                  <div
                    key={slot.itemId}
                    className="bg-stone-950 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                        <ItemIcon itemId={slot.itemId} size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-100 truncate">
                          {def.name} <span className="font-mono-num text-stone-400">×{slot.quantity}</span>
                        </div>
                        <div className="text-[11px] text-emerald-300 truncate">{effects.join(' · ')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => onConsumeInventoryItem(slot.itemId)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Santap
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
