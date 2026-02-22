// game/GameUI.js
// All HUD, event log, day/night, biodiversity, and performance display.
// Reads from EntityManager and World. Listens to EventBus for log events.
// No game logic lives here — pure presentation.

import { Events } from '../engine/EventBus.js';
import { SPECIES } from './SpeciesRegistry.js';

export class GameUI {
    constructor(world, entities, bus, config) {
        this.world    = world;
        this.entities = entities;
        this.bus      = bus;
        this.config   = config;

        this._lastHudUpdate          = 0;
        this._lastBiodiversityUpdate = 0;
        this._perfFrameStart         = 0;
        this._perfFps                = 60;
        this._perfFrameCount         = 0;
        this._perfLastTime           = performance.now();
        this._perfFrameTime          = 0;

        // Wire bus events
        bus.on(Events.LOG_EVENT,    ({ message }) => this.logEvent(message));
        bus.on(Events.HUD_REFRESH,  ()            => this.updateHUD(true));
        bus.on(Events.DAY_NIGHT_FLIP, ()          => this.updateDayNight());
        bus.on(Events.POLLUTION_CHANGED, ()       => this.updatePollutionIndicator());
    }

    // ── System update (called by Engine) ─────────────────────────────────────

    update(_dt, currentTime) {
        // Perf monitor
        this._perfFrameCount++;
        const now = performance.now();
        this._perfFrameTime = now - this._perfFrameStart;
        if (now - this._perfLastTime >= 1000) {
            this._perfFps        = this._perfFrameCount;
            this._perfFrameCount = 0;
            this._perfLastTime   = now;
            this._updatePerfDisplay();
        }
        this._perfFrameStart = performance.now();

        // Throttled HUD
        if (currentTime - this._lastHudUpdate >= this.config.HUD_UPDATE_THROTTLE) {
            this._lastHudUpdate = currentTime;
            this.updateHUD(false);
        }

        // Throttled biodiversity
        if (currentTime - this._lastBiodiversityUpdate >= this.config.BIODIVERSITY_UPDATE_THROTTLE) {
            this._lastBiodiversityUpdate = currentTime;
            this.updateBiodiversity();
        }
    }

    // ── HUD ──────────────────────────────────────────────────────────────────

    updateHUD(force = false) {
        const e = this.entities;
        this._setText('duck-count',      e.ducks.length);
        this._setText('egg-count',       e.eggs.length);
        this._setText('island-count',    e.islands.length);
        this._setText('predator-count',  e.predators.length);
        this._setText('fish-count',      e.fish.length);
        this._setText('food-count',      e.food.length);
        this._setText('creature-count',  e.seaCreatures.length);
        const timeEl = document.getElementById('time-elapsed');
        if (timeEl) timeEl.textContent = Math.floor(this.world.time) + 's';
    }

    // ── Biodiversity ─────────────────────────────────────────────────────────

    updateBiodiversity() {
        const speciesSet = new Set();
        for (const arr of this.entities.allArrays)
            for (const e of arr)
                if (e.speciesDef) speciesSet.add(e.speciesDef.id);

        const uniqueSpecies = speciesSet.size;
        const maxSpecies    = Object.values(SPECIES)
            .reduce((s, g) => s + Object.keys(g).length, 0);
        const balance = Math.min(100, (uniqueSpecies / maxSpecies) * 100);

        const totalAnimals = this.entities.ducks.length + this.entities.fish.length +
            this.entities.food.length + this.entities.seaCreatures.length +
            this.entities.octopi.length + this.entities.predators.length;
        const predatorRatio   = totalAnimals > 0 ? this.entities.predators.length / totalAnimals : 0;
        const predatorPenalty = predatorRatio > 0.2 ? (predatorRatio - 0.2) * 100 : 0;

        this.entities.biodiversity = Math.max(0, Math.min(100,
            balance - this.entities.waterPollution * 0.5 - predatorPenalty
        ));

        const fill  = document.getElementById('biodiversity-fill');
        const value = document.getElementById('biodiversity-value');
        if (!fill) return;
        const b = this.entities.biodiversity;
        fill.style.width = b + '%';
        if (value) value.textContent = Math.floor(b);
        fill.className = 'biodiversity-fill ' +
            (b > 70 ? 'biodiversity-high' : b > 40 ? 'biodiversity-medium' : 'biodiversity-low');
    }

    // ── Pollution ─────────────────────────────────────────────────────────────

    updatePollutionIndicator() {
        const fill  = document.getElementById('pollution-fill');
        const value = document.getElementById('pollution-value');
        if (!fill) return;
        const p = this.entities.waterPollution;
        fill.style.width = p + '%';
        if (value) value.textContent = Math.floor(p);
        fill.className = 'pollution-fill ' +
            (p < 30 ? 'pollution-low' : p < 60 ? 'pollution-medium' : 'pollution-high');
    }

    // ── Day/Night ─────────────────────────────────────────────────────────────

    updateDayNight() {
        const body = document.body;
        const icon = document.getElementById('time-of-day-icon');
        const text = document.getElementById('time-of-day');
        if (this.world.isNight) {
            body.classList.add('night');
            if (icon) icon.textContent = '🌙';
            if (text) text.textContent = 'Night';
        } else {
            body.classList.remove('night');
            if (icon) icon.textContent = '☀️';
            if (text) text.textContent = 'Day';
        }
    }

    // ── Stars ─────────────────────────────────────────────────────────────────

    createStars() {
        const stars = document.getElementById('stars');
        if (!stars) return;
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left           = Math.random() * 100 + '%';
            star.style.top            = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            stars.appendChild(star);
        }
    }

    // ── Event log ─────────────────────────────────────────────────────────────

    logEvent(message) {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry fade-in';
        entry.innerHTML = `<div class="log-time">${new Date().toLocaleTimeString()}</div>${message}`;
        logContent.insertBefore(entry, logContent.firstChild);
        while (logContent.children.length > 20) logContent.removeChild(logContent.lastChild);
    }

    // ── Performance display ───────────────────────────────────────────────────

    _updatePerfDisplay() {
        this._setText('fps-display',   this._perfFps);
        this._setText('frame-time',    this._perfFrameTime.toFixed(2));
        const entityEl = document.getElementById('entity-count');
        if (entityEl) {
            const e = this.entities;
            entityEl.textContent = e.ducks.length + e.fish.length +
                e.food.length + e.seaCreatures.length + e.octopi.length;
        }
    }

    // ── Button handlers (wired by main.js) ───────────────────────────────────

    togglePause(btn) {
        this.world.isPaused = !this.world.isPaused;
        if (btn) btn.textContent = this.world.isPaused ? '▶️ Resume' : '⏸️ Pause';
        this.logEvent(this.world.isPaused ? 'Game paused' : 'Game resumed');
    }

    toggleHUD() { document.getElementById('hud')?.classList.toggle('collapsed'); }
    toggleLog() { document.getElementById('ecosystem-log')?.classList.toggle('collapsed'); }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}
