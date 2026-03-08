// game/SpeciesRegistry.js
// Single source of truth for every organism in Sea of Ducks.
// Add a new species here — no other file needs to change.

import { isMobile } from './GameConfig.js';

export const SPECIES = {
    algae: {
        HEALTHY:  { id: 'algae_healthy', emoji: '🟢', name: 'Green Algae',   toxic: false, pollutionRate: -0.10, maxAge:  60, size: 24, MAX_COUNT: 40 },
        TOXIC:    { id: 'algae_toxic',   emoji: '🔴', name: 'Toxic Algae',   toxic: true,  pollutionRate:  0.50, maxAge:  45, size: 24, MAX_COUNT: 20 },
        KELP:     { id: 'kelp',          emoji: '🌿', name: 'Kelp',          toxic: false, pollutionRate: -0.15, maxAge: 120, size: 28, MAX_COUNT: 20, isKelp:     true },
        SEAGRASS: { id: 'seagrass',      emoji: '🌱', name: 'Seagrass',      toxic: false, pollutionRate: -0.05, maxAge: 200, size: 20, MAX_COUNT: 30, isSeagrass: true },
    },
    birds: {
        MALLARD:   { id: 'duck_mallard', emoji: '🦆', name: 'Mallard Duck', speed: 1.2, maxAge: 240, size: 48, MAX_COUNT: 30 },
        BABY_DUCK: { id: 'duck_baby',    emoji: '🐥', name: 'Duckling',     speed: 0.8, maxAge: 240, size: 36, MAX_COUNT: 30, isBaby: true },
        PELICAN:   { id: 'pelican',      emoji: '🦤', name: 'Pelican',      speed: 1.0, maxAge: 300, size: 44, MAX_COUNT: 10 },
        SWAN:      { id: 'swan',         emoji: '🦢', name: 'Swan',         speed: 1.0, maxAge: 220, size: 40, MAX_COUNT: 12 },
        FLAMINGO:  { id: 'flamingo',     emoji: '🦩', name: 'Flamingo',     speed: 0.6, maxAge: 200, size: 42, MAX_COUNT: 10, onIsland: true, islandOnly: true },
        GOOSE:     { id: 'goose',        emoji: '🦢', name: 'Goose',        speed: 1.3, maxAge: 180, size: 38, MAX_COUNT: 12 },
    },
    mammals: {
        CAT:     { id: 'cat',     emoji: '🐈', name: 'Cat',     speed: 1.4, maxAge: 150, size: 36, MAX_COUNT:  8, isPredator: true,  onIsland: true },
        DOG:     { id: 'dog',     emoji: '🐕', name: 'Dog',     speed: 1.2, maxAge: 120, size: 36, MAX_COUNT:  8, isPredator: true,  onIsland: true },
        WHALE:   { id: 'whale',   emoji: '🐳', name: 'Whale',   speed: 0.3, maxAge: 400, size: 48, MAX_COUNT:  5, isPredator: false, cssClass: 'whale'   },
        DOLPHIN: { id: 'dolphin', emoji: '🐬', name: 'Dolphin', speed: 0.9, maxAge: 250, size: 32, MAX_COUNT:  8, isPredator: false, cssClass: 'dolphin' },
        SEAL:    { id: 'seal',    emoji: '🦭', name: 'Seal',    speed: 0.5, maxAge: 200, size: 30, MAX_COUNT:  8, isPredator: false },
        OTTER:   { id: 'otter',   emoji: '🦦', name: 'Otter',   speed: 0.4, maxAge: 150, size: 28, MAX_COUNT: 10, isPredator: false },
    },
    fish: {
        SALMON:   { id: 'fish_salmon',   emoji: '🐟', name: 'Salmon',       speed: 0.60, maxAge: 120, size: 24, MAX_COUNT: 30, eatsAlgae: true  },
        TROPICAL: { id: 'fish_tropical', emoji: '🐠', name: 'Tropical Fish', speed: 0.70, maxAge: 100, size: 26, MAX_COUNT: 20, eatsAlgae: false },
        PUFFER:   { id: 'fish_puffer',   emoji: '🐡', name: 'Pufferfish',    speed: 0.20, maxAge: 120, size: 26, MAX_COUNT: 10, eatsAlgae: false, cssClass: 'pufferfish' },
        SHARK:    { id: 'fish_shark',    emoji: '🦈', name: 'Shark',         speed: 0.80, maxAge: 300, size: 32, MAX_COUNT:  5, eatsAlgae: false },
        SQUID:    { id: 'fish_squid',    emoji: '🦑', name: 'Squid',         speed: 0.60, maxAge: 180, size: 28, MAX_COUNT: 12, eatsAlgae: false },
        LOBSTER:  { id: 'fish_lobster',  emoji: '🦞', name: 'Lobster',       speed: 0.30, maxAge: 240, size: 28, MAX_COUNT: 10, eatsAlgae: true  },
        CRAB:     { id: 'fish_crab',     emoji: '🦀', name: 'Crab',          speed: 0.25, maxAge: 180, size: 26, MAX_COUNT: 12, eatsAlgae: true  },
        SHELL:    { id: 'fish_shell',    emoji: '🐚', name: 'Shell',         speed: 0,    maxAge: 600, size: 24, MAX_COUNT: 10, eatsAlgae: false, mobile: false, cssClass: 'shell' },
        OCTOPUS:  { id: 'octopus',       emoji: '🐙', name: 'Octopus',       speed: 0.80, maxAge: 150, size: 36, MAX_COUNT:  8, eatsAlgae: false, isOctopus: true },
    },
    prey: {
        SHRIMP:   { id: 'shrimp',      emoji: '🦐', name: 'Shrimp',      speed: 0.3, maxAge: 30, size: 20, MAX_COUNT: 40 },
        SHRIMP_B: { id: 'shrimp_baby', emoji: '🦐', name: 'Baby Shrimp', speed: 0.2, maxAge: 20, size: 12, MAX_COUNT: 40, isBaby: true },
    },
};

// Halve all caps on mobile after the table is defined
if (isMobile) {
    for (const group of Object.values(SPECIES))
        for (const def of Object.values(group))
            def.MAX_COUNT = Math.floor(def.MAX_COUNT / 2);
}
