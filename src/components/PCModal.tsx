import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  CloudRain,
  Coins,
  Computer,
  Lock,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CROPS,
  ITEMS,
  ORCHARD_LEFT_PRICE,
  ORCHARD_PLOT_MIN_LEVEL,
  ORCHARD_PRICE,
  ORCHARD_RIGHT_PRICE,
  SEASON_ORDER,
  SEASONS,
  WEATHER_LABELS,
} from '../data/cropsAndItems';
import {
  DailyOrder,
  InventorySlot,
  Season,
  UpgradesState,
  WeatherType,
} from '../types/game';
import { ItemIcon } from './ItemIcon';

interface PCModalProps {
  gold: number;
  playerLevel: number;
  season: Season;
  dayInSeason: number;
  weather: WeatherType;
  tomorrowWeather: WeatherType;
  rainfallMm: number;
  inventory: InventorySlot[];
  upgrades: UpgradesState;
  dailyOrder: DailyOrder | null;
  onBuyItem: (itemId: string, qty: number) => void;
  onBuyAndConsume: (itemId: string) => void;
  onSellItem: (itemId: string, qty: number) => void;
  onBuyUpgrade: (key: keyof UpgradesState, cost: number) => void;
  onDeliverOrder: () => void;
  onClose: () => void;
}

type PCTab = 'SHOP' | 'SELL' | 'PROPERTY' | 'BMKG';

export const PCModal: React.FC<PCModalProps> = ({
  gold,
  playerLevel,
  season,
  dayInSeason,
  weather,
  tomorrowWeather,
  rainfallMm,
  inventory,
  upgrades,
  dailyOrder,
  onBuyItem,
  onBuyAndConsume,
  onSellItem,
  onBuyUpgrade,
  onDeliverOrder,
  onClose,
}) => {
  const [tab, setTab] = useState<PCTab>('SHOP');
  const [shopFilter, setShopFilter] = useState<'CURRENT' | Season | 'GEAR'>('CURRENT');

  const activeSeasonFilter = shopFilter === 'CURRENT' ? season : shopFilter;

  const sellableSlots = inventory.filter((slot) => {
    const def = ITEMS[slot.itemId];
    return def && def.category !== 'TOOL' && (def.sellPrice ?? 0) > 0;
  });

  const consumableIds = ['paket_sarapan', 'pupuk_kompos', 'kopi_tubruk', 'es_kelapa', 'jamu_kencur', 'nasi_uduk'];

  const orderOwnedQty = dailyOrder
    ? inventory.find((s) => s.itemId === dailyOrder.itemId)?.quantity ?? 0
    : 0;

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-3 sm:p-6">
      <div className="animate-modal-pop w-full max-w-5xl max-h-[90vh] bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* PC OS Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-stone-950 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Computer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-stone-100 leading-tight">
                TaniNet PC — Portal Transaksi Online
              </h2>
              <p className="text-xs text-stone-400">
                Musim {SEASONS[season].name} · Hari {dayInSeason}/14 · Semua pembelian & penjualan dilakukan di sini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-700 px-3 py-1.5 rounded-lg font-mono-num text-sm font-bold text-amber-400">
              <Coins className="w-4 h-4" />
              <span>{gold.toLocaleString('id-ID')} EG</span>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Tutup PC"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-stone-900 border-b border-stone-800 overflow-x-auto">
          <button
            onClick={() => setTab('SHOP')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              tab === 'SHOP'
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-300 hover:bg-stone-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Toko Bibit & Perlengkapan</span>
          </button>
          <button
            onClick={() => setTab('SELL')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              tab === 'SELL'
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-300 hover:bg-stone-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Pasar Jual Hasil ({sellableSlots.length})</span>
          </button>
          <button
            onClick={() => setTab('PROPERTY')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              tab === 'PROPERTY'
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-300 hover:bg-stone-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Kebun Atas &amp; Lahan</span>
          </button>
          <button
            onClick={() => setTab('BMKG')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              tab === 'BMKG'
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-300 hover:bg-stone-800'
            }`}
          >
            <CloudRain className="w-4 h-4" />
            <span>BMKG & 4 Musim</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'SHOP' && (
            <>
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-1.5 bg-stone-950 p-1.5 rounded-xl border border-stone-800">
                <button
                  onClick={() => setShopFilter('CURRENT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    shopFilter === 'CURRENT'
                      ? 'bg-emerald-600 text-white'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  Musim Ini ({SEASONS[season].name})
                </button>
                {SEASON_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setShopFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      shopFilter === s
                        ? 'bg-stone-700 text-white'
                        : 'text-stone-400 hover:text-stone-100'
                    }`}
                  >
                    {SEASONS[s].name}
                  </button>
                ))}
                <button
                  onClick={() => setShopFilter('GEAR')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    shopFilter === 'GEAR'
                      ? 'bg-amber-600 text-white'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  Peralatan & Bekal
                </button>
              </div>

              {/* Pesan Sarapan Online Quick Card */}
              {(() => {
                const breakfast = ITEMS.paket_sarapan;
                const price = breakfast?.buyPrice ?? 45;
                const canAfford = gold >= price;
                return (
                  <div className="bg-stone-950/80 border border-amber-500/35 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                        <ItemIcon itemId="paket_sarapan" size={30} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-100 text-sm">{breakfast.name}</h3>
                        <p className="text-xs text-stone-400">
                          Pesan antar pagi untuk memulihkan <strong className="text-rose-400">+25 Health</strong> &amp; <strong className="text-emerald-400">+20 Speed</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onBuyAndConsume('paket_sarapan')}
                        disabled={!canAfford}
                        className="py-2 px-3.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap font-mono-num"
                      >
                        Beli &amp; Santap ({price} EG)
                      </button>
                      <button
                        onClick={() => onBuyItem('paket_sarapan', 1)}
                        disabled={!canAfford}
                        className="py-2 px-3 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap font-mono-num"
                      >
                        Simpan ke Tas
                      </button>
                    </div>
                  </div>
                );
              })()}

              {shopFilter !== 'GEAR' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-stone-400 px-1">
                    <span>
                      Bibit Musim <strong className="text-stone-200">{SEASONS[activeSeasonFilter as Season].name}</strong> ·{' '}
                      {SEASONS[activeSeasonFilter as Season].rainfallRange}
                    </span>
                    {activeSeasonFilter !== season && (
                      <span className="text-amber-400 font-medium">
                        Catatan: Hanya bisa ditanam saat musim {SEASONS[activeSeasonFilter as Season].name}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {Object.values(CROPS)
                      .filter((c) => c.season === activeSeasonFilter)
                      .map((crop) => {
                        const owned = inventory.find((i) => i.itemId === crop.seedId)?.quantity ?? 0;
                        const canAfford1 = gold >= crop.seedPrice;
                        const canAfford5 = gold >= crop.seedPrice * 5;
                        return (
                          <div
                            key={crop.id}
                            className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                                    <ItemIcon itemId={crop.seedId} size={28} />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-stone-100 text-sm">{crop.name}</h3>
                                    <div className="text-[11px] text-stone-400">
                                      Tumbuh {crop.growthDays} hari · Jual {crop.sellPrice} EG
                                    </div>
                                  </div>
                                </div>
                                {owned > 0 && (
                                  <span className="font-mono-num text-xs text-emerald-400 font-semibold">
                                    Milik: {owned}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-400 leading-relaxed">{crop.description}</p>
                              <div className="text-[11px] text-sky-300">
                                Kebutuhan Hujan: {crop.rainPreference}
                                {crop.droughtResistant ? ' · Tahan Kering' : ''}
                                {crop.waterLover ? ' · Cepat saat Hujan' : ''}
                                {crop.regrowDays ? ` · Panen ulang /${crop.regrowDays}h` : ''}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                              <button
                                onClick={() => onBuyItem(crop.seedId, 1)}
                                disabled={!canAfford1}
                                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                              >
                                Beli 1 ({crop.seedPrice} EG)
                              </button>
                              <button
                                onClick={() => onBuyItem(crop.seedId, 5)}
                                disabled={!canAfford5}
                                className="py-2 px-3 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-100 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                              >
                                ×5 ({crop.seedPrice * 5})
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Upgrades */}
                  <div>
                    <h3 className="text-sm font-semibold text-stone-200 mb-3">Peningkatan Peralatan Kebun</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="font-semibold text-stone-100 text-sm">Ember Siram Besar</div>
                          <p className="text-xs text-stone-400 mt-1">
                            Kapasitas air naik dari 20 menjadi 45, dan menyiram 3 petak sekaligus ke depan!
                          </p>
                        </div>
                        <button
                          onClick={() => onBuyUpgrade('bigWateringCan', 800)}
                          disabled={upgrades.bigWateringCan || gold < 800}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 disabled:bg-stone-800 disabled:text-stone-400 text-stone-950 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                        >
                          {upgrades.bigWateringCan ? 'Sudah Dimiliki' : 'Beli 800 EG'}
                        </button>
                      </div>

                      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="font-semibold text-stone-100 text-sm">Cangkul Baja Nusantara</div>
                          <p className="text-xs text-stone-400 mt-1">
                            Menggemburkan 3 petak tanah sekaligus dan lebih hemat tenaga!
                          </p>
                        </div>
                        <button
                          onClick={() => onBuyUpgrade('steelHoe', 1400)}
                          disabled={upgrades.steelHoe || gold < 1400}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-400 text-stone-950 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                        >
                          {upgrades.steelHoe ? 'Sudah Dimiliki' : 'Beli 1.400 EG'}
                        </button>
                      </div>

                      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="font-semibold text-stone-100 text-sm">Sepatu Boot Anti-Hujan</div>
                          <p className="text-xs text-stone-400 mt-1">
                            Mencegah penurunan Mood & Speed saat bertani di bawah Hujan Deras!
                          </p>
                        </div>
                        <button
                          onClick={() => onBuyUpgrade('rainBoots', 550)}
                          disabled={upgrades.rainBoots || gold < 550}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-400 text-stone-950 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                        >
                          {upgrades.rainBoots ? 'Sudah Dimiliki' : 'Beli 550 EG'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Consumables & Fertilizer */}
                  <div>
                    <h3 className="text-sm font-semibold text-stone-200 mb-3">Pupuk & Bekal Pemulih HP (Health · Mood · Speed)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {consumableIds.map((id) => {
                        const item = ITEMS[id];
                        const price = item.buyPrice ?? 0;
                        const owned = inventory.find((s) => s.itemId === id)?.quantity ?? 0;
                        return (
                          <div
                            key={id}
                            className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                                <ItemIcon itemId={id} size={26} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-stone-100 text-sm">{item.name}</h4>
                                  {owned > 0 && <span className="font-mono-num text-xs text-emerald-400">{owned}</span>}
                                </div>
                                <p className="text-xs text-stone-400 mt-1">{item.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onBuyItem(id, 1)}
                                disabled={gold < price}
                                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                              >
                                Beli ({price} EG)
                              </button>
                              {(item.restoreHealth || item.restoreMood || item.boostSpeed) && (
                                <button
                                  onClick={() => onBuyAndConsume(id)}
                                  disabled={gold < price}
                                  className="py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  Santap
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'SELL' && (
            <div className="space-y-5">
              {/* Daily Online Export Order */}
              {dailyOrder && (
                <div className="bg-stone-950 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <PackageCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-amber-400">Kontrak Ekspor Online Hari Ini (+60% Bonus Harga)</div>
                      <h3 className="text-base font-bold text-stone-100 mt-0.5">
                        Kirim {dailyOrder.requiredQty} {dailyOrder.itemName}
                      </h3>
                      <p className="text-xs text-stone-400 mt-0.5 font-mono-num">
                        Terkirim: {dailyOrder.deliveredQty}/{dailyOrder.requiredQty} · Di Tas Anda: {orderOwnedQty} · Harga kontrak: {((ITEMS[dailyOrder.itemId]?.sellPrice ?? 0) + dailyOrder.bonusPerUnit).toLocaleString('id-ID')} EG/unit
                      </p>
                    </div>
                  </div>

                  {dailyOrder.completed ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Kontrak Selesai</span>
                    </div>
                  ) : (
                    <button
                      onClick={onDeliverOrder}
                      disabled={orderOwnedQty <= 0}
                      className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      Kirim Pesanan
                    </button>
                  )}
                </div>
              )}

              {sellableSlots.length === 0 ? (
                <div className="text-center py-12 text-stone-400 border border-dashed border-stone-800 rounded-xl">
                  <p className="text-sm font-medium">Tas hasil panen & hutan masih kosong.</p>
                  <p className="text-xs text-stone-500 mt-1">
                    Panen tanaman dari kebun atau kumpulkan kayu & jamur di Hutan sebelah kanan untuk dijual di sini.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sellableSlots.map((slot) => {
                    const def = ITEMS[slot.itemId];
                    const unitPrice = def.sellPrice ?? 0;
                    const totalVal = unitPrice * slot.quantity;
                    return (
                      <div
                        key={slot.itemId}
                        className="bg-stone-950/70 border border-stone-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                            <ItemIcon itemId={slot.itemId} size={26} />
                          </div>
                          <div>
                            <div className="font-semibold text-stone-100 text-sm">
                              {def.name} <span className="font-mono-num text-stone-400">×{slot.quantity}</span>
                            </div>
                            <div className="font-mono-num text-xs text-amber-400">
                              {unitPrice.toLocaleString('id-ID')} EG / unit
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onSellItem(slot.itemId, 1)}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Jual 1
                          </button>
                          <button
                            onClick={() => onSellItem(slot.itemId, slot.quantity)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer font-mono-num"
                          >
                            Jual Semua (+{totalVal.toLocaleString('id-ID')})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'PROPERTY' && (
            <div className="space-y-5">
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Sertifikat Akses Lahan Utara</span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-stone-100 mt-1">
                      Kebun Atas Nusantara
                    </h3>
                    <p className="text-sm text-stone-400 mt-1 max-w-2xl">
                      Terletak di sebelah utara Kebun Utama. Membuka gerbang batu menuju jalan Kebun Atas, Hutan Pohon Kalabas Tua, Laboratorium Penelitian, dan Robot Mecha Coklat!
                    </p>
                  </div>

                  <div className="text-left md:text-right shrink-0">
                    <div className="text-xs text-stone-400">Harga Sertifikat Akses</div>
                    <div className="font-mono-num text-2xl font-bold text-amber-400">
                      {ORCHARD_PRICE.toLocaleString('id-ID')} EG
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-3.5">
                    <div className="text-xs font-semibold text-stone-200">2 Blok Lahan Vulkanik</div>
                    <p className="text-xs text-stone-400 mt-1">Tanah vulkanik di sisi kiri &amp; kanan jalan Kebun Atas masih tersegel dan harus dibeli terpisah (Min. Lv.{ORCHARD_PLOT_MIN_LEVEL}).</p>
                  </div>
                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-3.5">
                    <div className="text-xs font-semibold text-stone-200">Hutan Kalabas &amp; Lab Utara</div>
                    <p className="text-xs text-stone-400 mt-1">Jalan di utara Kebun Atas menuju scene Lab Penelitian yang dikelilingi puluhan Pohon Kalabas Tua (jatuh 1 pcs tiap 2 hari &amp; separo berbuah acak tiap 3 hari).</p>
                  </div>
                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-3.5">
                    <div className="text-xs font-semibold text-stone-200">Robot Mecha Penjaga</div>
                    <p className="text-xs text-stone-400 mt-1">Lawan Robot Mecha Coklat di depan Lab (HP reset jam 03.00 pagi) atau miliki di Lv.7.</p>
                  </div>
                </div>

                <div className="pt-2">
                  {upgrades.orchardDeed ? (
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                      <Award className="w-5 h-5" />
                      <span>Sertifikat Akses Kebun Atas sudah menjadi milik Anda!</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onBuyUpgrade('orchardDeed', ORCHARD_PRICE)}
                      disabled={gold < ORCHARD_PRICE}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {gold < ORCHARD_PRICE ? <Lock className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                      <span>
                        {gold >= ORCHARD_PRICE
                          ? 'Beli Akses Kebun Atas Sekarang (1.000.000 EG)'
                          : `Emas Kurang (${(ORCHARD_PRICE - gold).toLocaleString('id-ID')} EG lagi)`}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pembelian Lahan Kebun Atas Kiri & Kanan Jalan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    key: 'orchardLeftDeed' as const,
                    title: 'Kebun Atas Sebelah Kiri Jalan',
                    desc: 'Membuka segel 96 petak lahan vulkanik subur di sebelah kiri jalan Kebun Atas agar bisa dicangkul dan ditanami.',
                    price: ORCHARD_LEFT_PRICE,
                    owned: upgrades.orchardLeftDeed,
                  },
                  {
                    key: 'orchardRightDeed' as const,
                    title: 'Kebun Atas Sebelah Kanan Jalan',
                    desc: 'Membuka segel 96 petak lahan vulkanik subur di sebelah kanan jalan Kebun Atas agar bisa dicangkul dan ditanami.',
                    price: ORCHARD_RIGHT_PRICE,
                    owned: upgrades.orchardRightDeed,
                  },
                ].map((plotCard) => {
                  const meetsLevel = playerLevel >= ORCHARD_PLOT_MIN_LEVEL;
                  const meetsGold = gold >= plotCard.price;
                  const canBuy = !plotCard.owned && meetsLevel && meetsGold;
                  return (
                    <div
                      key={plotCard.key}
                      className="bg-stone-950 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-400">
                            Syarat: Minimal Level {ORCHARD_PLOT_MIN_LEVEL}
                          </span>
                          <span
                            className={`font-mono-num text-xs font-semibold ${
                              meetsLevel ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            Level Anda: Lv.{playerLevel}
                          </span>
                        </div>
                        <h4 className="font-display text-lg font-bold text-stone-100">
                          {plotCard.title}
                        </h4>
                        <p className="text-xs text-stone-400 leading-relaxed">{plotCard.desc}</p>
                        <div className="pt-1 font-mono-num text-xl font-bold text-amber-400">
                          {plotCard.price.toLocaleString('id-ID')} EG
                        </div>
                        {!upgrades.orchardDeed && !plotCard.owned && (
                          <p className="text-[11px] text-stone-500">
                            Catatan: Buka juga Sertifikat Akses Kebun Atas (1.000.000 EG) untuk melewati gerbang utara.
                          </p>
                        )}
                      </div>

                      {plotCard.owned ? (
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Segel Terbuka — Siap Ditanami</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => onBuyUpgrade(plotCard.key, plotCard.price)}
                          disabled={!canBuy}
                          className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed font-mono-num"
                        >
                          {!canBuy ? <Lock className="w-4 h-4 shrink-0" /> : <Award className="w-4 h-4 shrink-0" />}
                          <span>
                            {!meetsLevel
                              ? `Terkunci (Butuh Level ${ORCHARD_PLOT_MIN_LEVEL})`
                              : !meetsGold
                              ? `Emas Kurang (${(plotCard.price - gold).toLocaleString('id-ID')} EG lagi)`
                              : `Buka Segel (${plotCard.price.toLocaleString('id-ID')} EG)`}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'BMKG' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-stone-950 border border-stone-800 rounded-xl p-4">
                  <div className="text-xs text-stone-400">Cuaca Hari Ini</div>
                  <div className="text-lg font-bold text-stone-100 mt-1">
                    {WEATHER_LABELS[weather].label} · <span className="font-mono-num text-sky-400">{rainfallMm} mm</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    {WEATHER_LABELS[weather].watersCrops
                      ? 'Hujan alami menyiram seluruh tanaman luar ruangan hari ini!'
                      : 'Tidak ada hujan hari ini. Pastikan menyiram kebun menggunakan Ember Siram.'}
                  </p>
                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-xl p-4">
                  <div className="text-xs text-stone-400">Prakiraan Cuaca Besok (BMKG Desa)</div>
                  <div className="text-lg font-bold text-amber-300 mt-1">
                    {WEATHER_LABELS[tomorrowWeather].label}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    {WEATHER_LABELS[tomorrowWeather].watersCrops
                      ? 'Besok diprediksi turun hujan. Cocok untuk menanam bibit penyuka air!'
                      : 'Besok diprediksi kering/berawan. Siapkan air di sumur.'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-stone-200 mb-3">Almanak 4 Musim & Siklus Curah Hujan Nusantara (14 Hari / Musim)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {SEASON_ORDER.map((s) => {
                    const meta = SEASONS[s];
                    const seasonCrops = Object.values(CROPS).filter((c) => c.season === s);
                    const isNow = s === season;
                    return (
                      <div
                        key={s}
                        className={`rounded-xl p-4 border ${
                          isNow ? 'bg-stone-950 border-amber-500/60' : 'bg-stone-950/60 border-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-base" style={{ color: meta.accentHex }}>
                            {meta.name} {isNow ? '(Sedang Berlangsung)' : ''}
                          </h4>
                          <span className="text-xs text-stone-400">{meta.subtitle}</span>
                        </div>
                        <p className="text-xs text-stone-300 mt-1.5">{meta.description}</p>
                        <div className="text-xs text-sky-300 mt-2">{meta.rainfallRange}</div>
                        <div className="text-xs text-stone-400 mt-1">Tanaman: {seasonCrops.map((c) => c.name).join(' · ')}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
