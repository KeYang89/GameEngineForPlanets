// engine/World.js
// World geometry, simulation time, and day/night cycle.
// Systems query this instead of touching the DOM directly.

export class World {
    constructor(config) {
        this.oceanFraction    = 0.40;          // ocean surface = 40% down screen
        this.isNight          = false;
        this.dayNightCycle    = 0;
        this.dayNightDuration = config.DAY_NIGHT_DURATION ?? 60; // seconds per phase
        this.time             = 0;
        this.frameCount       = 0;
        this.isPaused         = false;
        this._container       = null;
    }

    /** Must be called once the DOM is ready. */
    init(containerEl) {
        this._container = containerEl;
    }

    // ── Geometry ──────────────────────────────────

    get width()    { return this._container?.clientWidth  ?? 800; }
    get height()   { return this._container?.clientHeight ?? 600; }
    get oceanTop() { return this.height * this.oceanFraction; }

    isInOcean(y)   { return y >= this.oceanTop; }

    clampX(x, margin = 50) {
        return Math.max(0, Math.min(x, this.width - margin));
    }

    clampOceanY(y, margin = 50) {
        return Math.max(this.oceanTop, Math.min(y, this.height - margin));
    }

    randomOceanX(margin = 50)  { return Math.random() * (this.width  - margin); }
    randomOceanY(depthFraction = 0.3) {
        return this.oceanTop + Math.random() * this.height * depthFraction;
    }

    // ── Time ──────────────────────────────────────

    /**
     * Advance simulation time. Returns true when day/night phase flips.
     * Called by Engine.loop() before systems run.
     */
    tick(dt) {
        if (this.isPaused) return false;
        this.time       += dt;
        this.frameCount += 1;
        this.dayNightCycle += dt;
        if (this.dayNightCycle >= this.dayNightDuration) {
            this.dayNightCycle = 0;
            this.isNight = !this.isNight;
            return true;
        }
        return false;
    }
}
