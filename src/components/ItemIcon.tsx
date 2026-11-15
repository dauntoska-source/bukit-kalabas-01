import React from 'react';
import { ITEMS } from '../data/cropsAndItems';

interface ItemIconProps {
  itemId: string;
  size?: number;
}

function renderCropEmblem(cropId: string, scale = 1, offsetX = 0, offsetY = 0): React.ReactNode {
  const transform =
    scale === 1 && offsetX === 0 && offsetY === 0
      ? undefined
      : `translate(${offsetX}, ${offsetY}) scale(${scale})`;

  switch (cropId) {
    case 'jagung_manis':
      return (
        <g transform={transform}>
          {/* Corn cob */}
          <rect x="12" y="6" width="8" height="17" rx="4" fill="#FACC15" stroke="#854D0E" strokeWidth="1.3" />
          <path d="M12.5 11H19.5M12.5 15H19.5M16 7V21" stroke="#CA8A04" strokeWidth="1" opacity="0.7" />
          <circle cx="14.5" cy="9" r="0.9" fill="#FEF9C3" />
          <circle cx="14.5" cy="13" r="0.9" fill="#FEF9C3" />
          {/* Husk leaves */}
          <path d="M12 16C9 18 10 25 16 26C14 23 13 19 12 16Z" fill="#22C55E" stroke="#14532D" strokeWidth="1.2" />
          <path d="M20 16C23 18 22 25 16 26C18 23 19 19 20 16Z" fill="#16A34A" stroke="#14532D" strokeWidth="1.2" />
        </g>
      );

    case 'cabai_rawit':
      return (
        <g transform={transform}>
          <path d="M15 7C17 7 18 9 16 11" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
          {/* Two fiery chilies */}
          <path
            d="M14 11C10 12 9 19 13 25C14.5 22 15.5 16 14 11Z"
            fill="#F97316"
            stroke="#7C2D12"
            strokeWidth="1.2"
          />
          <path
            d="M17 10C22 12 22 20 16 26C15 21 15 14 17 10Z"
            fill="#EF4444"
            stroke="#7F1D1D"
            strokeWidth="1.3"
          />
          <path d="M13 10.5H19" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="18.2" cy="15" r="1.1" fill="#FCA5A5" />
        </g>
      );

    case 'kedelai':
      return (
        <g transform={transform}>
          {/* Soybean pod */}
          <path
            d="M8 21C10 12 18 8 24 10C23 17 16 23 8 21Z"
            fill="#EAB308"
            stroke="#713F12"
            strokeWidth="1.3"
          />
          <circle cx="13" cy="18" r="2.2" fill="#FEF08A" stroke="#854D0E" strokeWidth="0.9" />
          <circle cx="17.2" cy="15.2" r="2.2" fill="#FEF08A" stroke="#854D0E" strokeWidth="0.9" />
          <circle cx="21" cy="12.5" r="1.9" fill="#FEF08A" stroke="#854D0E" strokeWidth="0.9" />
          <path d="M7 21L10 17" stroke="#4D7C0F" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'bawang_merah':
      return (
        <g transform={transform}>
          {/* Twin crimson shallot bulbs */}
          <path d="M14 11V6M18 11V7" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="13" cy="19" rx="5.5" ry="6" fill="#A21CAF" stroke="#4A044E" strokeWidth="1.3" />
          <ellipse cx="19" cy="20" rx="5" ry="5.5" fill="#C026D3" stroke="#4A044E" strokeWidth="1.3" />
          <path d="M11 16C11 19 11 22 13 24" stroke="#F0ABFC" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
          <path d="M17.5 17C17.5 19.5 17.5 22 19 24" stroke="#F5D0FE" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
        </g>
      );

    case 'semangka':
      return (
        <g transform={transform}>
          {/* Striped whole watermelon + rosy slice accent */}
          <circle cx="16" cy="17" r="9.5" fill="#16A34A" stroke="#052E16" strokeWidth="1.3" />
          <path d="M12 8.5C10 14 10 20 12 25.5M16 7.6C15 14 15 20 16 26.4M20 8.5C22 14 22 20 20 25.5" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 7.5C16 5.5 18 4.5 20 5.5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" />
          <ellipse cx="13" cy="13" rx="2.2" ry="1.2" transform="rotate(-30 13 13)" fill="rgba(255,255,255,0.45)" />
        </g>
      );

    case 'singkong':
      return (
        <g transform={transform}>
          {/* Crossed cassava tubers with creamy white cut tip */}
          <g transform="rotate(-24 16 17)">
            <rect x="6" y="13" width="19" height="7" rx="3.5" fill="#92400E" stroke="#451A03" strokeWidth="1.3" />
            <circle cx="22.5" cy="16.5" r="2.2" fill="#FEF3C7" />
          </g>
          <g transform="rotate(18 16 19)">
            <rect x="7" y="16" width="17" height="6.2" rx="3.1" fill="#B45309" stroke="#451A03" strokeWidth="1.3" />
            <path d="M11 19H20" stroke="#78350F" strokeWidth="1" />
          </g>
          <path d="M9 11L13 14" stroke="#65A30D" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'kacang_tanah':
      return (
        <g transform={transform}>
          {/* Peanut waisted pods */}
          <g transform="rotate(-30 16 16)">
            <path
              d="M9 16C9 12.5 12 11.5 14.5 13C15.5 13.5 16.5 13.5 17.5 13C20 11.5 23 12.5 23 16C23 19.5 20 20.5 17.5 19C16.5 18.5 15.5 18.5 14.5 19C12 20.5 9 19.5 9 16Z"
              fill="#D97706"
              stroke="#78350F"
              strokeWidth="1.3"
            />
            <path d="M12 14.5L20 17.5M12 17.5L20 14.5" stroke="#92400E" strokeWidth="0.9" opacity="0.6" />
          </g>
          <circle cx="21" cy="22" r="2.5" fill="#FDE68A" stroke="#92400E" strokeWidth="1" />
        </g>
      );

    case 'tomat_lokal':
      return (
        <g transform={transform}>
          {/* Plump red tomato with star calyx */}
          <circle cx="16" cy="17.5" r="9" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.3" />
          <path d="M16 7V11M12 10L16 12L20 10M13 13L16 11.5L19 13" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="12.5" cy="14.5" rx="2" ry="1.3" transform="rotate(-30 12.5 14.5)" fill="#FCA5A5" />
        </g>
      );

    case 'terong_ungu':
      return (
        <g transform={transform}>
          {/* Glossy curved purple eggplant */}
          <path
            d="M17 9C21 10 23 16 20 22C17 26.5 11 26 10 22C9 18 12 12 17 9Z"
            fill="#7E22CE"
            stroke="#3B0764"
            strokeWidth="1.3"
          />
          <path d="M14 10L17 7L20 11L17 12.5L14 10Z" fill="#22C55E" stroke="#14532D" strokeWidth="1.1" />
          <ellipse cx="14" cy="18.5" rx="1.4" ry="3.4" transform="rotate(20 14 18.5)" fill="#D8B4FE" opacity="0.7" />
        </g>
      );

    case 'padi_sawah':
      return (
        <g transform={transform}>
          {/* Bound golden rice sheaf */}
          <path d="M13 26L11 12M16 26V9M19 26L21 12" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
          <rect x="12" y="20" width="8" height="2.4" rx="1" fill="#B45309" />
          <path d="M11 12C9 8 8 6 11 6C13 6 13 9 11 12Z" fill="#EAB308" stroke="#854D0E" strokeWidth="1" />
          <path d="M16 10C15 6 17 4 19 6C20 8 18 10 16 10Z" fill="#FACC15" stroke="#854D0E" strokeWidth="1" />
          <path d="M21 12C23 8 24 6 21 6C19 7 20 10 21 12Z" fill="#EAB308" stroke="#854D0E" strokeWidth="1" />
        </g>
      );

    case 'kangkung':
      return (
        <g transform={transform}>
          {/* Crisp bundle of hollow jade stems & arrowhead leaves */}
          <path d="M13 25L12 13M16 26V11M19 25L20 13" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          <rect x="12" y="20.5" width="8" height="2" rx="1" fill="#F59E0B" />
          <path d="M12 6L7 15L12 13L15 15L12 6Z" fill="#22C55E" stroke="#065F46" strokeWidth="1.1" />
          <path d="M20 7L16 15L20 13.5L25 15L20 7Z" fill="#16A34A" stroke="#065F46" strokeWidth="1.1" />
        </g>
      );

    case 'talas':
      return (
        <g transform={transform}>
          {/* Purple-flecked taro corm + small heart leaf */}
          <ellipse cx="16" cy="19" rx="7" ry="6" fill="#7C3AED" stroke="#3B0764" strokeWidth="1.3" />
          <path d="M11 18H21M12 21.5H20" stroke="#DDD6FE" strokeWidth="1.1" opacity="0.65" />
          <path d="M16 13V8" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 9C19 5 24 7 22 11C20 12 17 11 16 9Z" fill="#22C55E" stroke="#064E3B" strokeWidth="1.1" />
        </g>
      );

    default:
      return (
        <g transform={transform}>
          <circle cx="16" cy="17" r="8" fill="#22C55E" stroke="#14532D" strokeWidth="1.3" />
        </g>
      );
  }
}

export const ItemIcon: React.FC<ItemIconProps> = ({ itemId, size = 28 }) => {
  const item = ITEMS[itemId];
  if (!item) return null;

  if (item.toolKind === 'HOE') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M6 26L21 11" stroke="#92400E" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M18 8L25 15L22 18L15 11L18 8Z" fill="#CBD5E1" stroke="#334155" strokeWidth="1.5" />
      </svg>
    );
  }
  if (item.toolKind === 'WATERING_CAN') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="9" y="13" width="14" height="12" rx="2" fill="#0284C7" stroke="#E0F2FE" strokeWidth="1.4" />
        <path d="M9 17L4 12" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 13V9C14 7.5 19 7.5 19 9V13" stroke="#BAE6FD" strokeWidth="2" />
      </svg>
    );
  }
  if (item.toolKind === 'AXE') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M7 25L22 10" stroke="#92400E" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M16 6C21 6 25 10 25 15L18 14L16 6Z" fill="#E2E8F0" stroke="#334155" strokeWidth="1.5" />
      </svg>
    );
  }
  if (item.toolKind === 'SCYTHE') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M7 26L20 11" stroke="#B45309" strokeWidth="3" strokeLinecap="round" />
        <path d="M20 11C24 6 28 8 27 15C25 12 22 11 20 11Z" fill="#F1F5F9" stroke="#334155" strokeWidth="1.4" />
      </svg>
    );
  }

  // Illustrated Kraft Seed Packets with Crop Emblem
  if (item.category === 'SEED') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="6" y="4.5" width="20" height="23" rx="3" fill="#FEF3C7" stroke="#78350F" strokeWidth="1.5" />
        <path d="M6.5 8.5H25.5" stroke="#B45309" strokeWidth="1.1" strokeDasharray="2 1.5" />
        <rect x="8.5" y="10.5" width="15" height="14.5" rx="2" fill="#FFFBEB" stroke={item.iconColor} strokeWidth="1" />
        {item.cropId ? renderCropEmblem(item.cropId, 0.56, 7.1, 8.8) : null}
      </svg>
    );
  }

  // Harvested Seasonal Crops
  if (item.category === 'CROP' && item.cropId) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        {renderCropEmblem(item.cropId)}
      </svg>
    );
  }

  // Orchard Perennial Fruits (Kebun Atas)
  if (item.id === 'buah_mangga') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path
          d="M16 7C21 7 25 11 24 18C23 24 18 27 13 25C9 23.5 8 18 10 13C11.5 9.5 13.5 7 16 7Z"
          fill="#F59E0B"
          stroke="#78350F"
          strokeWidth="1.3"
        />
        <path d="M12 11C15 8.5 20 9.5 21.5 13.5C18.5 14 14 14 12 11Z" fill="#EF4444" opacity="0.7" />
        <path d="M16 7C18 4 22 4.5 22 7C20 8 17.5 8 16 7Z" fill="#16A34A" stroke="#14532D" strokeWidth="1" />
        <ellipse cx="12.5" cy="16" rx="1.4" ry="2.8" transform="rotate(-15 12.5 16)" fill="#FEF3C7" opacity="0.7" />
      </svg>
    );
  }

  if (item.id === 'buah_durian') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 4V8" stroke="#78350F" strokeWidth="2.4" strokeLinecap="round" />
        {/* Spiky shell */}
        <path
          d="M16 7L19 9.5L22.5 9L23 13L26 15.5L23.8 18.5L25 22L21.5 23.5L19.5 26.5L16 25.2L12.5 26.5L10.5 23.5L7 22L8.2 18.5L6 15.5L9 13L9.5 9L13 9.5L16 7Z"
          fill="#CA8A04"
          stroke="#422006"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <ellipse cx="16" cy="17" rx="5.5" ry="6.2" fill="#EAB308" opacity="0.55" />
        <path d="M13 14L15 16M18 14L19 16M15 20L17 21" stroke="#422006" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }

  if (item.id === 'kelapa_gading') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="18" rx="8.5" ry="9" fill="#FACC15" stroke="#854D0E" strokeWidth="1.3" />
        <path d="M11 10.5L16 6.5L21 10.5L16 12L11 10.5Z" fill="#15803D" stroke="#052E16" strokeWidth="1.1" />
        <ellipse cx="12.5" cy="15.5" rx="1.6" ry="3" transform="rotate(-15 12.5 15.5)" fill="#FEF9C3" opacity="0.7" />
      </svg>
    );
  }

  if (item.id === 'buah_kalabas') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 5V9" stroke="#78350F" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 8C19 5.5 23 6.5 21 9.5C19 10 17 9.5 16 8Z" fill="#15803D" stroke="#052E16" strokeWidth="1" />
        <ellipse cx="16" cy="18.5" rx="9" ry="9.5" fill="#65A30D" stroke="#1A2E05" strokeWidth="1.4" />
        <path d="M10.5 17C10.5 21 12.5 24.5 16 26" stroke="#3F6212" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
        <ellipse cx="12.5" cy="14.5" rx="2.1" ry="1.3" transform="rotate(-28 12.5 14.5)" fill="#ECFCCB" opacity="0.8" />
      </svg>
    );
  }

  if (item.weaponKind === 'SWORD') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M7 25L12 20" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M9.5 17.5L14.5 22.5" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M12.5 19.5L23.5 6.5L26 6L25.5 8.5L14.5 21.5L12.5 19.5Z"
          fill="#38BDF8"
          stroke="#0F172A"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M14.5 19L24 8" stroke="#E0F2FE" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }

  if (item.weaponKind === 'RIFLE') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M5 21L11 17L13 19.5L8.5 24L5 21Z" fill="#78350F" stroke="#29170B" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M10.5 16.5L25 8L27 10.5L12.5 19L10.5 16.5Z" fill="#334155" stroke="#0F172A" strokeWidth="1.3" strokeLinejoin="round" />
        <rect x="14" y="13" width="5" height="2.4" rx="0.8" transform="rotate(-30 14 13)" fill="#F59E0B" />
        <path d="M14 12.5L18.5 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  // River Fish Icons
  if (item.id === 'ikan_wader') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M23 16L28 11V21L23 16Z" fill="#94A3B8" stroke="#334155" strokeWidth="1.2" strokeLinejoin="round" />
        <ellipse cx="14.5" cy="16" rx="9" ry="4.8" fill="#CBD5E1" stroke="#334155" strokeWidth="1.3" />
        <path d="M8 14.5C12 12.5 18 12.5 21 15" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9.2" cy="15.2" r="1.2" fill="#0F172A" />
      </svg>
    );
  }

  if (item.id === 'ikan_lele') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M23 16L28.5 11.5V20.5L23 16Z" fill="#475569" stroke="#0F172A" strokeWidth="1.2" strokeLinejoin="round" />
        <path
          d="M6 16C6 11.5 12 10.5 19 12C22 12.8 24 14.5 24 16C24 17.5 22 19.2 19 20C12 21.5 6 20.5 6 16Z"
          fill="#334155"
          stroke="#0F172A"
          strokeWidth="1.3"
        />
        <path d="M10 19.5C14 20.5 18 20 21 18.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        {/* Catfish whiskers */}
        <path d="M7 14.5L3.5 11.5M6.5 16.5L3 16.5M7 18.2L4 21" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="9.2" cy="15" r="1.2" fill="#FDE047" />
      </svg>
    );
  }

  if (item.id === 'ikan_tomang') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M22.5 16L29 10V22L22.5 16Z" fill="#0F766E" stroke="#042F2E" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M12 11.2C15 8.5 19 8.5 21.5 11.5" fill="#14B8A6" stroke="#042F2E" strokeWidth="1.1" />
        <ellipse cx="14.5" cy="16.2" rx="9.8" ry="5.6" fill="#0D9488" stroke="#042F2E" strokeWidth="1.4" />
        {/* Signature Tomang stripes & orange belly accent */}
        <path d="M11 12.2L12.5 16.5M15 11.5L16.5 16.8M19 12.2L20 16.5" stroke="#134E4A" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 19.5C13 21.2 18 21 21 19" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8.8" cy="15" r="1.4" fill="#FDE047" stroke="#042F2E" strokeWidth="0.6" />
      </svg>
    );
  }

  // Forest Forageables
  if (item.id === 'jamur_liar') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="13" y="16" width="6" height="10" rx="2" fill="#FEF3C7" stroke="#78350F" strokeWidth="1.3" />
        <path d="M6 17C6 10 10.5 7 16 7C21.5 7 26 10 26 17H6Z" fill="#D97706" stroke="#78350F" strokeWidth="1.3" />
        <circle cx="12" cy="12" r="1.8" fill="#FEF3C7" />
        <circle cx="19" cy="11" r="1.4" fill="#FEF3C7" />
        <circle cx="16" cy="14.5" r="1.2" fill="#FEF3C7" />
      </svg>
    );
  }

  if (item.id === 'daun_herbal') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 26V12" stroke="#065F46" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 14C10 14 7 9 9 6C13 6 16 9 16 14Z" fill="#34D399" stroke="#065F46" strokeWidth="1.2" />
        <path d="M16 14C22 14 25 9 23 6C19 6 16 9 16 14Z" fill="#10B981" stroke="#065F46" strokeWidth="1.2" />
        <path d="M16 21C10 21 8 17 10 15C13 15 15 18 16 21Z" fill="#10B981" stroke="#065F46" strokeWidth="1.1" />
        <path d="M16 21C22 21 24 17 22 15C19 15 17 18 16 21Z" fill="#059669" stroke="#065F46" strokeWidth="1.1" />
        <circle cx="16" cy="6.5" r="1.6" fill="#FEF08A" />
      </svg>
    );
  }

  if (item.id === 'akar_ginseng') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 13V6" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
        <circle cx="14" cy="6" r="1.7" fill="#EF4444" />
        <circle cx="18" cy="6" r="1.7" fill="#EF4444" />
        <path
          d="M14 13H18L19 19L22 25L18 22L16 27L14 22L10 25L13 19L14 13Z"
          fill="#FBBF24"
          stroke="#78350F"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (item.id === 'pupuk_kompos') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M9 11H23L25 26H7L9 11Z" fill="#78350F" stroke="#451A03" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M11 11L13 7H19L21 11" fill="#92400E" stroke="#451A03" strokeWidth="1.3" />
        <path d="M16 22V15M16 17C14 15 12 15 12 17C12 18.5 14 19 16 18M16 17C18 15 20 15 20 17C20 18.5 18 19 16 18" stroke="#A3E635" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (item.id === 'paket_sarapan') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        {/* Warm ceramic breakfast plate */}
        <circle cx="16" cy="18" r="11" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.4" />
        <circle cx="16" cy="18" r="8.2" fill="#FEF3C7" stroke="#E2E8F0" strokeWidth="0.9" />
        {/* Sunny-side-up egg */}
        <path
          d="M10 18C10 15 12.5 13.5 15.5 14C18 14.4 21 15 21.5 17.5C22 20 19 22 15.5 22C12 22 10 20.5 10 18Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        <circle cx="15" cy="17.8" r="2.8" fill="#F59E0B" stroke="#D97706" strokeWidth="0.8" />
        {/* Golden toast/tempe accent */}
        <rect x="17.5" y="13" width="5.5" height="4.5" rx="1.2" transform="rotate(15 17.5 13)" fill="#D97706" stroke="#78350F" strokeWidth="0.9" />
        {/* Warm breakfast steam */}
        <path d="M12 8.5C12.8 6.5 14.2 6.5 13.5 8.5M18 8C18.8 6 20.2 6 19.5 8" stroke="#FBBF24" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (item.category === 'CONSUMABLE') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="17" r="9" fill={item.iconColor} stroke={item.accentColor} strokeWidth="2" />
        <path d="M12 9C13 6 15 6 14 9M18 9C19 6 21 6 20 9" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (item.id === 'kayu_hutan') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="5" y="11" width="22" height="10" rx="3" fill="#92400E" stroke="#FDE68A" strokeWidth="1.2" />
        <circle cx="24" cy="16" r="3" fill="#FDE68A" />
      </svg>
    );
  }

  if (item.id === 'batu_alam') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M7 21L11 10L21 9L26 19L19 24H10L7 21Z" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="1.3" />
      </svg>
    );
  }

  // Fallback
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="17" r="8.5" fill={item.iconColor} stroke="#1C1917" strokeWidth="1.2" />
      <path d="M16 8C19 5 23 6 21 10C19 10 17 10 16 8Z" fill={item.accentColor} />
    </svg>
  );
};
