// engine/Core.js
// The main engine loop. Knows nothing about ducks, fish, or oceans.
// Add systems via addSystem(). Call start() to begin.

export class Engine {
    constructor({ targetFPS = 60 } = {}) {
        this.targetFPS      = targetFPS;
        this.targetFrameMs  = 1000 / targetFPS;
        this.systems        = [];
        this.isRunning      = false;
        this._lastTime      = 0;
        this._rafId         = null;

        this._loop = this._loop.bind(this);
    }

    /** Register a system. Systems are updated in insertion order. */
    addSystem(system) {
        this.systems.push(system);
        return this; // chainable
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._rafId = requestAnimationFrame(this._loop);
    }

    stop() {
        this.isRunning = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    _loop(currentTime) {
        if (!this.isRunning) return;
        this._rafId = requestAnimationFrame(this._loop);

        const elapsed = currentTime - this._lastTime;

        // Skip frames that arrive too early (FPS cap)
        if (elapsed < this.targetFrameMs) return;

        // Cap dt to avoid huge jumps after tab becomes hidden
        const dt = Math.min(elapsed / 1000, 0.1);
        this._lastTime = currentTime - (elapsed % this.targetFrameMs);

        for (const system of this.systems) {
            system.update(dt, currentTime);
        }
    }
}
