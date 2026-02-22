// game/GameConfig.js
// All tunable constants. Import this before anything else.

export const CONFIG = {
    UPDATE_FPS:                    60,
    THINK_COOLDOWN:              3000,   // ms between AI decision ticks
    SPATIAL_GRID_SIZE:            150,
    HUD_UPDATE_THROTTLE:          500,
    BIODIVERSITY_UPDATE_THROTTLE: 1000,
    ALGAE_SPAWN_INTERVAL:           8,   // seconds between natural algae spawns
    PARTICLE_POOL_SIZE:            50,
    MAX_ISLANDS:                    8,
};

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
    CONFIG.UPDATE_FPS     = 30;
    CONFIG.THINK_COOLDOWN = 5000;
}
