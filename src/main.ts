import { Game } from './core/Game';
import { KART_PRESETS } from './entities/KartMesh';
import { KartCustomization, SpoilerStyle, LiveryPattern, RimStyle } from './types';

// Paint palette options (Hex numbers and names)
const PAINT_COLORS = [
  { name: 'Cyan Rush', hex: 0x06b6d4 },
  { name: 'Crimson Red', hex: 0xe11d48 },
  { name: 'Royal Violet', hex: 0x8b5cf6 },
  { name: 'Solar Gold', hex: 0xf59e0b },
  { name: 'Emerald Green', hex: 0x10b981 },
  { name: 'Hot Pink', hex: 0xec4899 },
  { name: 'Deep Azure', hex: 0x2563eb },
  { name: 'Stealth Black', hex: 0x18181b }
];

const LIVERY_PATTERNS: { pattern: LiveryPattern; name: string; icon: string; desc: string }[] = [
  { pattern: 'RACING_STRIPES', name: 'Dual Stripes', icon: '⚡', desc: 'Twin center sport stripes with number 07' },
  { pattern: 'CYBER_HEX', name: 'Cyber Hex', icon: '💠', desc: 'Neon honeycomb tech grid & chevrons' },
  { pattern: 'LIGHTNING', name: 'Thunderbolt', icon: '⚡', desc: 'High-voltage electric lightning forks' },
  { pattern: 'DRAGON_FLAME', name: 'Dragon Flame', icon: '🔥', desc: 'Aggressive street flame contours' },
  { pattern: 'CARBON_WEAVE', name: 'Carbon Fiber', icon: '🏁', desc: 'Lightweight twill carbon fiber weave' },
  { pattern: 'CLEAN', name: 'Pure Gloss', icon: '✨', desc: 'Clean metallic mirror paint coat' }
];

const RIM_STYLES: { style: RimStyle; name: string; icon: string; desc: string }[] = [
  { style: 'SPORT_5SPOKE', name: '5-Spoke Star', icon: '⭐', desc: 'Lightweight forged 5-spoke racing star' },
  { style: 'CYBER_TURBINE', name: 'Cyber Turbine', icon: '🌀', desc: 'Aerodynamic directional turbine blades' },
  { style: 'AERO_DISC', name: 'Aero Disc', icon: '💿', desc: 'Solid low-drag wind-tunnel aero disc' },
  { style: 'WIRE_STAR', name: 'Wire Mesh', icon: '🕸️', desc: 'Multi-spoke high-tensile wire mesh' }
];

const NEON_COLORS = [
  { name: 'Electric Cyan', hex: 0x00f0ff },
  { name: 'Crimson Laser', hex: 0xff0055 },
  { name: 'Plasma Violet', hex: 0xd946ef },
  { name: 'Bright Gold', hex: 0xffd700 },
  { name: 'Toxic Emerald', hex: 0x34d399 },
  { name: 'Neon Coral', hex: 0xff4d4d },
  { name: 'Deep Indigo', hex: 0x6366f1 },
  { name: 'Pure White', hex: 0xffffff }
];

const EXHAUST_COLORS = [
  { name: 'Cyan Turbo', hex: 0x00f0ff },
  { name: 'Inferno Red', hex: 0xff3b30 },
  { name: 'Solar Flare', hex: 0xffaa00 },
  { name: 'Violet Plasma', hex: 0xa855f7 },
  { name: 'Acid Green', hex: 0x10b981 },
  { name: 'Hyper White', hex: 0xffffff }
];

const SPOILER_STYLES: { style: SpoilerStyle; name: string; icon: string; desc: string }[] = [
  { style: 'GT_WING', name: 'GT High Wing', icon: '🏎️', desc: 'Dual-deck carbon wing' },
  { style: 'CYBER_FIN', name: 'Cyber Fin', icon: '✈️', desc: 'Fighter jet twin fins' },
  { style: 'JET_PODS', name: 'Jet Pods', icon: '🚀', desc: 'Twin rocket thrusters' },
  { style: 'DUCKTAIL', name: 'Ducktail', icon: '🏁', desc: 'Aero street ducktail' }
];


window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();

  const startScreen = document.getElementById('start-screen')!;
  const startBtn = document.getElementById('start-btn')!;
  const garageBtn = document.getElementById('garage-btn')!;
  const garageScreen = document.getElementById('garage-screen')!;
  const garageCloseX = document.getElementById('garage-close-x')!;
  const garageBackBtn = document.getElementById('garage-back-btn')!;
  const garageRaceBtn = document.getElementById('garage-race-btn')!;
  const currentKartNameEl = document.getElementById('garage-current-name')!;

  // Active customization state
  let currentCustom: KartCustomization = { ...game.kartCustomization };

  // --- 1. Setup UI Generators ---
  const presetsContainer = document.getElementById('presets-list')!;
  const paintContainer = document.getElementById('paint-swatches')!;
  const neonContainer = document.getElementById('neon-swatches')!;
  const exhaustContainer = document.getElementById('exhaust-swatches')!;
  const spoilerContainer = document.getElementById('spoiler-options')!;
  const liveryOptionsContainer = document.getElementById('livery-options')!;
  const liverySwatchesContainer = document.getElementById('livery-swatches')!;
  const rimOptionsContainer = document.getElementById('rim-options')!;
  const rimSwatchesContainer = document.getElementById('rim-swatches')!;

  const hexToString = (hex: number) => '#' + hex.toString(16).padStart(6, '0');

  // Render Presets
  const renderPresets = () => {
    presetsContainer.innerHTML = '';
    KART_PRESETS.forEach((preset) => {
      const card = document.createElement('div');
      card.className = `preset-card ${currentCustom.presetName === preset.presetName ? 'active' : ''}`;
      card.innerHTML = `
        <div class="preset-info">
          <h4>${preset.presetName}</h4>
          <p>${preset.liveryPattern.replace('_', ' ')} • ${preset.spoilerStyle.replace('_', ' ')}</p>
        </div>
        <div style="display: flex; gap: 6px;">
          <div style="width: 18px; height: 18px; border-radius: 50%; background: ${hexToString(preset.primaryColor)}; border: 1px solid #fff;"></div>
          <div style="width: 18px; height: 18px; border-radius: 50%; background: ${hexToString(preset.neonColor)}; box-shadow: 0 0 8px ${hexToString(preset.neonColor)};"></div>
        </div>
      `;
      card.addEventListener('click', () => {
        currentCustom = { ...preset };
        applyAndUpdate();
      });
      presetsContainer.appendChild(card);
    });
  };

  // Render Livery Options (Hoa văn / Decals)
  const renderLiveryOptions = () => {
    if (!liveryOptionsContainer) return;
    liveryOptionsContainer.innerHTML = '';
    LIVERY_PATTERNS.forEach((p) => {
      const card = document.createElement('div');
      const isSelected = currentCustom.liveryPattern === p.pattern;
      card.className = `spoiler-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div style="font-size: 1.8rem; margin-bottom: 6px;">${p.icon}</div>
        <div style="font-weight: bold; font-size: 0.92rem; margin-bottom: 4px;">${p.name}</div>
        <div style="font-size: 0.72rem; color: #94a3b8;">${p.desc}</div>
      `;
      card.addEventListener('click', () => {
        currentCustom.liveryPattern = p.pattern;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      liveryOptionsContainer.appendChild(card);
    });
  };

  // Render Livery Swatches (Màu hoa văn)
  const renderLiverySwatches = () => {
    if (!liverySwatchesContainer) return;
    liverySwatchesContainer.innerHTML = '';
    PAINT_COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      const isSelected = currentCustom.liveryColor === color.hex;
      swatch.className = `color-swatch ${isSelected ? 'active' : ''}`;
      swatch.style.backgroundColor = hexToString(color.hex);
      swatch.title = color.name;
      if (isSelected) {
        swatch.innerHTML = '<span style="font-size: 1.1rem; color: #fff; text-shadow: 0 0 4px #000;">✓</span>';
      }
      swatch.addEventListener('click', () => {
        currentCustom.liveryColor = color.hex;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      liverySwatchesContainer.appendChild(swatch);
    });
  };

  // Render Rim Options (Mâm bánh xe)
  const renderRimOptions = () => {
    if (!rimOptionsContainer) return;
    rimOptionsContainer.innerHTML = '';
    RIM_STYLES.forEach((r) => {
      const card = document.createElement('div');
      const isSelected = currentCustom.rimStyle === r.style;
      card.className = `spoiler-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div style="font-size: 1.8rem; margin-bottom: 6px;">${r.icon}</div>
        <div style="font-weight: bold; font-size: 0.92rem; margin-bottom: 4px;">${r.name}</div>
        <div style="font-size: 0.72rem; color: #94a3b8;">${r.desc}</div>
      `;
      card.addEventListener('click', () => {
        currentCustom.rimStyle = r.style;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      rimOptionsContainer.appendChild(card);
    });
  };

  // Render Rim Color Swatches
  const renderRimSwatches = () => {
    if (!rimSwatchesContainer) return;
    rimSwatchesContainer.innerHTML = '';
    NEON_COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      const isSelected = currentCustom.neonColor === color.hex;
      swatch.className = `color-swatch ${isSelected ? 'active' : ''}`;
      swatch.style.backgroundColor = hexToString(color.hex);
      swatch.style.boxShadow = `0 0 12px ${hexToString(color.hex)}`;
      swatch.title = color.name;
      if (isSelected) {
        swatch.innerHTML = '<span style="font-size: 1.1rem; color: #000; font-weight: bold;">✓</span>';
      }
      swatch.addEventListener('click', () => {
        currentCustom.neonColor = color.hex;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      rimSwatchesContainer.appendChild(swatch);
    });
  };

  // Render Paint Swatches
  const renderPaintSwatches = () => {
    paintContainer.innerHTML = '';
    PAINT_COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      const isSelected = currentCustom.primaryColor === color.hex;
      swatch.className = `color-swatch ${isSelected ? 'active' : ''}`;
      swatch.style.backgroundColor = hexToString(color.hex);
      swatch.title = color.name;
      if (isSelected) {
        swatch.innerHTML = '<span style="font-size: 1.1rem; color: #fff; text-shadow: 0 0 4px #000;">✓</span>';
      }
      swatch.addEventListener('click', () => {
        currentCustom.primaryColor = color.hex;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      paintContainer.appendChild(swatch);
    });
  };

  // Render Neon Swatches
  const renderNeonSwatches = () => {
    neonContainer.innerHTML = '';
    NEON_COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      const isSelected = currentCustom.neonColor === color.hex;
      swatch.className = `color-swatch ${isSelected ? 'active' : ''}`;
      swatch.style.backgroundColor = hexToString(color.hex);
      swatch.style.boxShadow = `0 0 14px ${hexToString(color.hex)}`;
      swatch.title = color.name;
      if (isSelected) {
        swatch.innerHTML = '<span style="font-size: 1.1rem; color: #000; font-weight: bold;">✓</span>';
      }
      swatch.addEventListener('click', () => {
        currentCustom.neonColor = color.hex;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      neonContainer.appendChild(swatch);
    });
  };

  // Render Exhaust Swatches
  const renderExhaustSwatches = () => {
    exhaustContainer.innerHTML = '';
    EXHAUST_COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      const isSelected = currentCustom.exhaustColor === color.hex;
      swatch.className = `color-swatch ${isSelected ? 'active' : ''}`;
      swatch.style.backgroundColor = hexToString(color.hex);
      swatch.style.boxShadow = `0 0 12px ${hexToString(color.hex)}`;
      swatch.title = color.name;
      if (isSelected) {
        swatch.innerHTML = '<span style="font-size: 1.1rem; color: #000; font-weight: bold;">✓</span>';
      }
      swatch.addEventListener('click', () => {
        currentCustom.exhaustColor = color.hex;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      exhaustContainer.appendChild(swatch);
    });
  };

  // Render Spoilers
  const renderSpoilers = () => {
    spoilerContainer.innerHTML = '';
    SPOILER_STYLES.forEach((s) => {
      const card = document.createElement('div');
      const isSelected = currentCustom.spoilerStyle === s.style;
      card.className = `spoiler-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div style="font-size: 1.8rem; margin-bottom: 6px;">${s.icon}</div>
        <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 4px;">${s.name}</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">${s.desc}</div>
      `;
      card.addEventListener('click', () => {
        currentCustom.spoilerStyle = s.style;
        currentCustom.presetName = 'Custom';
        applyAndUpdate();
      });
      spoilerContainer.appendChild(card);
    });
  };

  const applyAndUpdate = () => {
    game.updatePlayerCustomization(currentCustom);
    if (currentKartNameEl) {
      currentKartNameEl.innerText = currentCustom.presetName.toUpperCase();
    }
    renderPresets();
    renderLiveryOptions();
    renderLiverySwatches();
    renderPaintSwatches();
    renderRimOptions();
    renderRimSwatches();
    renderNeonSwatches();
    renderExhaustSwatches();
    renderSpoilers();
  };

  // --- 2. Setup Tabs & Part-by-Part Camera Focus ---
  const tabButtons = document.querySelectorAll('.garage-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab') || 'presets';
      document.querySelectorAll('.tab-pane').forEach((pane) => {
        (pane as HTMLElement).style.display = 'none';
      });

      const activePane = document.getElementById(`tab-${targetTab}`);
      if (activePane) {
        activePane.style.display = 'block';
      }

      // Smoothly move 3D camera to focus on this part
      switch (targetTab) {
        case 'presets':
          game.focusGaragePart('OVERVIEW');
          break;
        case 'livery':
          game.focusGaragePart('LIVERY');
          break;
        case 'paint':
          game.focusGaragePart('BODY');
          break;
        case 'rims':
          game.focusGaragePart('RIMS');
          break;
        case 'spoiler':
          game.focusGaragePart('SPOILER');
          break;
        case 'exhaust':
          game.focusGaragePart('EXHAUST');
          break;
        case 'neon':
          game.focusGaragePart('NEON');
          break;
        default:
          game.focusGaragePart('OVERVIEW');
          break;
      }
    });
  });

  // --- 3. Interactive 360° Mouse / Touch Drag Showroom Rotation ---
  let isPointerDown = false;
  let lastPointerX = 0;

  window.addEventListener('pointerdown', (e) => {
    // Only drag rotate when not clicking inside the controls panel
    if (game.state === 'GARAGE' && !e.composedPath().some(el => (el as HTMLElement).classList?.contains('garage-panel'))) {
      isPointerDown = true;
      lastPointerX = e.clientX;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (isPointerDown && game.state === 'GARAGE') {
      const deltaX = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      game.rotateGarageKart(deltaX * 0.008);
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDown = false;
  });

  window.addEventListener('pointercancel', () => {
    isPointerDown = false;
  });

  // --- 4. Setup Navigation Actions ---
  const openGarage = () => {
    startScreen.style.display = 'none';
    garageScreen.style.display = 'flex';
    game.openGarage();
    game.focusGaragePart('OVERVIEW');
    applyAndUpdate();
  };

  const closeGarage = () => {
    garageScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    game.closeGarage();
  };

  const startRaceFromGarage = () => {
    garageScreen.style.display = 'none';
    game.closeGarage();
    game.startCountdown();
  };

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startScreen.style.display = 'none';
      game.startCountdown();
    });
  }

  if (garageBtn) {
    garageBtn.addEventListener('click', openGarage);
  }

  if (garageCloseX) {
    garageCloseX.addEventListener('click', closeGarage);
  }

  if (garageBackBtn) {
    garageBackBtn.addEventListener('click', closeGarage);
  }

  if (garageRaceBtn) {
    garageRaceBtn.addEventListener('click', startRaceFromGarage);
  }

  // Initial render
  applyAndUpdate();

});
