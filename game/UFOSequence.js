// game/UFOSequence.js
// Self-contained UFO water-sampling cinematic sequence.
// Mirrors the UFO/SampleTube behaviour from eco.js, ported to the
// modular architecture (no global gameState, uses EntityManager + EventBus).
//
// Usage (from main.js):
//   import { UFOSequence } from './game/UFOSequence.js';
//   UFOSequence.trigger(container, world, entities, bus);
//
// The uncommented import in main.js:
//   import { UFOSequence } from './game/UFOSequence.js';
// And the window.gameActions handler:
//   triggerUFO: () => UFOSequence.trigger(container, world, entities, bus),

import { Events } from '../engine/EventBus.js';

// ─────────────────────────────────────────────────────────────────────────────
//  SampleTube
// ─────────────────────────────────────────────────────────────────────────────

class SampleTube {
    /**
     * @param {number} id
     * @param {number} x        – horizontal centre
     * @param {number} startY   – Y just below the UFO body
     * @param {HTMLElement} container
     * @param {object} entities – EntityManager (holds waterPollution)
     */
    constructor(id, x, startY, container, entities) {
        this.id        = id;
        this.x         = x;
        this.startY    = startY;
        this.y         = startY;
        this.container = container;
        this.entities  = entities;  // waterPollution lives here, not on World

        // State machine: lowering → collecting → retracting → complete
        this.state          = 'lowering';
        this.collectTimer   = 0;
        this.hasEntered     = false;

        // Target: 100 px below the water surface
        const waterSurface  = container.clientHeight * 0.40;
        this.targetDepth    = waterSurface + 100;

        this.element = this._createElement();
    }

    _createElement() {
        const el = document.createElement('div');
        el.className = 'sample-tube fade-in';
        el.style.cssText = `position:absolute;left:${this.x}px;top:${this.y}px;z-index:200;display:flex;flex-direction:column;align-items:center;`;
        el.innerHTML = `
            <div class="tube-string"  style="width:2px;background:#aaa;height:0px;"></div>
            <div class="tube-container" style="display:flex;flex-direction:column;align-items:center;">
                <div class="tube-cap"  style="font-size:14px;">⬛</div>
                <div class="tube-body" style="width:16px;height:50px;border:2px solid #999;border-radius:0 0 8px 8px;overflow:hidden;background:#e8f4fd;">
                    <div class="tube-water" style="height:0%;background:linear-gradient(180deg,#4ecdc4,#3e8ed0);transition:height 0.1s;margin-top:auto;"></div>
                </div>
            </div>`;
        this.container.appendChild(el);
        return el;
    }

    update(dt) {
        const waterSurface = this.container.clientHeight * 0.40;

        switch (this.state) {
            case 'lowering':
                this.y += 150 * dt;
                if (!this.hasEntered && this.y > waterSurface) {
                    this.hasEntered = true;
                    this._splash();
                }
                if (this.y >= this.targetDepth) {
                    this.y     = this.targetDepth;
                    this.state = 'collecting';
                }
                break;

            case 'collecting':
                this.collectTimer += dt;
                const progress = Math.min(1, this.collectTimer / 2);
                const waterEl  = this.element.querySelector('.tube-water');
                if (waterEl) {
                    waterEl.style.height = (progress * 80) + '%';
                    const p = this.entities.waterPollution ?? 0;
                    waterEl.style.background = p < 20
                        ? 'linear-gradient(180deg,#4ecdc4,#3e8ed0)'
                        : p < 50
                            ? 'linear-gradient(180deg,#95e1d3,#6bb6af)'
                            : 'linear-gradient(180deg,#8b7355,#6b5744)';
                }
                if (this.collectTimer >= 2) {
                    this.state = 'retracting';
                }
                break;

            case 'retracting':
                this.y -= 150 * dt;
                if (this.y <= this.startY) {
                    this.y     = this.startY;
                    this.state = 'complete';
                }
                break;

            case 'complete':
                // Hang under UFO — nothing to do
                break;
        }

        this.element.style.top = this.y + 'px';

        // Stretch the string to match distance from startY
        const string = this.element.querySelector('.tube-string');
        if (string) string.style.height = Math.max(0, this.y - this.startY) + 'px';
    }

    _splash() {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                const p       = document.createElement('div');
                p.textContent = '💧';
                p.style.cssText = `position:absolute;left:${this.x + (Math.random() - 0.5) * 30}px;top:${this.y}px;font-size:16px;pointer-events:none;z-index:300;animation:splashFloat 0.8s ease-out forwards;`;
                this.container.appendChild(p);
                setTimeout(() => p.remove(), 800);
            }, i * 50);
        }
    }

    destroy() {
        this.element.remove();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  UFO
// ─────────────────────────────────────────────────────────────────────────────

class UFO {
    /**
     * @param {number}      id
     * @param {number}      hoverY  – Y to hover at (px from top)
     * @param {HTMLElement} container
     * @param {object}      world
     * @param {object}      bus     – EventBus
     * @param {Function}    onDone  – called when UFO has left the screen
     */
    constructor(id, hoverY, container, world, entities, bus, onDone) {
        this.id        = id;
        this.container = container;
        this.world     = world;
        this.entities  = entities;
        this.bus       = bus;
        this.onDone    = onDone;

        this.x         = container.clientWidth / 2 - 40; // centred
        this.y         = -150;                            // offscreen top
        this.hoverY    = hoverY;

        this.state         = 'entering';
        this.hoverTimer    = 0;
        this.tubes         = [];
        this._nextTubeId   = 1;

        this.element = this._createElement();
    }

    _createElement() {
        const el = document.createElement('div');
        el.className = 'ufo fade-in';
        el.style.cssText = `position:absolute;left:${this.x}px;top:${this.y}px;z-index:999;font-size:64px;text-align:center;filter:drop-shadow(0 0 18px #7af);`;

        el.innerHTML = `
            <div class="ufo-body">🛸</div>
            <div class="ufo-beam" style="
                width:80px;height:0px;margin:-20px auto 10px 0px;
                background:linear-gradient(180deg,rgba(100,200,255,0.4),transparent);
                transition:height 0.5s;"></div>
        `;


        el.querySelector('.ufo-body').addEventListener('click', (e) => {
            e.stopPropagation();
            this._showTripModal();
        });

        this.container.appendChild(el);
        return el;
    }

    _showTripModal() {
        // Prevent multiple modals
        if (document.querySelector('#ufo-trip-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'ufo-trip-modal';
        modal.style.cssText = `
            position: fixed;
            top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.6);
            display:flex; align-items:center; justify-content:center;
            z-index:2000;
        `;

        modal.innerHTML = `
            <div style="background:#fff; padding:24px; border-radius:12px; text-align:center; max-width:400px;">
                <h2>🚀 Would you like to take a trip?</h2>
                <div style="margin-top:16px;">
                    <button id="ufo-trip-yes" style="
                        padding:10px 16px;
                        margin-right:8px;
                        background:#4ecdc4;
                        color:#fff;
                        border:none;
                        border-radius:8px;
                        cursor:pointer;
                    ">Yes</button>
                    <button id="ufo-trip-no" style="
                        padding:10px 16px;
                        background:#ccc;
                        color:#333;
                        border:none;
                        border-radius:8px;
                        cursor:pointer;
                    ">No</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Yes button → open UFO.html in new tab
        modal.querySelector('#ufo-trip-yes').addEventListener('click', () => {
            window.open('UFO.html', '_blank');
            modal.remove();
        });

        // No button or clicking backdrop → close modal
        modal.querySelector('#ufo-trip-no').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    update(dt) {
        switch (this.state) {
            case 'entering':
                this.y += 100 * dt;
                if (this.y >= this.hoverY) {
                    this.y     = this.hoverY;
                    this.state = 'hovering';
                    this.element.classList.add('hovering');
                    // Extend the beam
                    const beam = this.element.querySelector('.ufo-beam');
                    if (beam) beam.style.height = '60px';
                    this.bus.emit(Events.LOG_EVENT, { message: 'UFO has arrived and is hovering! 🛸' });
                }
                break;

            case 'hovering':
                this.hoverTimer += dt;
                if (this.hoverTimer >= 2) {
                    this.state = 'deploying';
                    this._deployTubes();
                }
                break;

            case 'deploying':
                // Tube deployment is timer-driven; transition to 'collecting' is handled inside _deployTubes
                break;

            case 'collecting':
                this.tubes.forEach(t => t.update(dt));
                if (this.tubes.length > 0 && this.tubes.every(t => t.state === 'complete')) {
                    this.state = 'leaving';
                    setTimeout(() => {
                        this.bus.emit(Events.LOG_EVENT, { message: 'Sample collection complete! UFO departing… 🛸✨' });
                        this._showCelebration();
                    }, 800);
                }
                break;

            case 'leaving':
                this.y -= 150 * dt;
                // Keep tubes anchored under the UFO as it rises
                this.tubes.forEach(t => {
                    t.startY = this.y + 70;
                    t.update(dt);
                });
                if (this.y < -200) {
                    this.destroy();
                    return;
                }
                break;
        }

        this.element.style.top = this.y + 'px';
    }

    _deployTubes() {
        const NUM_TUBES = 5;
        const SPACING   = 80;
        const startX    = this.x + 40 - (NUM_TUBES - 1) * SPACING / 2; // centre under UFO
        const tubeY     = this.hoverY + 70; // just below the UFO body

        for (let i = 0; i < NUM_TUBES; i++) {
            setTimeout(() => {
                const tube = new SampleTube(
                    this._nextTubeId++,
                    startX + i * SPACING,
                    tubeY,
                    this.container,
                    this.entities,   // was this.world — waterPollution lives on EntityManager
                );
                this.tubes.push(tube);
            }, i * 300);
        }

        // Switch to collecting after all tubes are deployed
        setTimeout(() => {
            this.state = 'collecting';
            this.bus.emit(Events.LOG_EVENT, { message: `Collecting ${NUM_TUBES} water samples… 💧` });
        }, NUM_TUBES * 300 + 500);
    }

    _showCelebration() {
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const sp       = document.createElement('div');
                sp.textContent = ['✨', '⭐', '💫', '🌟'][Math.floor(Math.random() * 4)];
                sp.style.cssText = `
                    position:absolute;
                    left:${Math.random() * this.container.clientWidth}px;
                    top:${Math.random() * this.container.clientHeight}px;
                    font-size:${20 + Math.random() * 30}px;
                    pointer-events:none;z-index:300;
                    animation:splashFloat 2s ease-out forwards;`;
                this.container.appendChild(sp);
                setTimeout(() => sp.remove(), 2000);
            }, i * 100);
        }
    }

    destroy() {
        this.tubes.forEach(t => t.destroy());
        this.tubes = [];
        this.element.remove();
        if (typeof this.onDone === 'function') this.onDone();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  UFOSequence  (public API)
// ─────────────────────────────────────────────────────────────────────────────

export class UFOSequence {
    static _active = false;
    static _ufo    = null;

    /**
     * Trigger a UFO water-sampling flyby.
     *
     * @param {HTMLElement} container  – #game-container
     * @param {object}      world      – World instance (needs .waterPollution)
     * @param {object}      entities   – EntityManager (unused directly, reserved for future use)
     * @param {object}      bus        – EventBus
     */
    static trigger(container, world, entities, bus) {
        if (UFOSequence._active) {
            bus.emit(Events.LOG_EVENT, { message: 'UFO is already here! Please wait… 🛸' });
            return;
        }

        UFOSequence._active = true;
        bus.emit(Events.LOG_EVENT, { message: '🛸 UFO detected! Approaching for sample collection…' });

        let nextId = 1;
        UFOSequence._ufo = new UFO(
            nextId++,
            100,          // hover 100 px from the top
            container,
            world,
            entities,     // needed for waterPollution read in SampleTube
            bus,
            () => {       // onDone callback
                UFOSequence._active = false;
                UFOSequence._ufo    = null;
            },
        );
    }

    static update(dt) {
        if (UFOSequence._ufo) UFOSequence._ufo.update(dt);
    }
}