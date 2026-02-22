// engine/Systems/RenderSystem.js
// Owns the DOM. Syncs every entity's position and state to its element.
// Entities no longer touch the DOM directly — they update their own
// x/y/state and this system pushes those values into CSS each frame.
// The domMap tracks entity → element so we can create and destroy nodes.

export class RenderSystem {
    constructor(world, entities, container) {
        this.world     = world;
        this.entities  = entities;
        this.container = container;
        // entity → HTMLElement
        this.domMap    = new Map();
    }

    update(_dt) {
        const allArrays = this.entities.allArrays;

        // All entities that need to be in the DOM
        const live = new Set();
        for (const arr of allArrays)
            for (const e of arr) live.add(e);

        // Sync existing or create new elements
        for (const e of live) {
            if (!this.domMap.has(e)) {
                const el = this._createElement(e);
                if (el) {
                    this.domMap.set(e, el);
                    this.container.appendChild(el);
                }
            }
            const el = this.domMap.get(e);
            if (el) this._syncElement(e, el);
        }

        // Remove stale elements for entities no longer in any pool
        for (const [e, el] of this.domMap.entries()) {
            if (!live.has(e)) {
                el.remove();
                this.domMap.delete(e);
            }
        }
    }

    // ── DOM creation per entity type ─────────────────────────────────────────

    _createElement(entity) {
        // Entities opt in by exposing a createElement() on themselves.
        // This keeps entity-specific HTML (duck stats bars, etc.) in the entity class.
        if (typeof entity.createElement === 'function') {
            const el = entity.createElement(this.container);
            entity.element = el;
            return el;
        }
        // Generic fallback for simple entities
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;pointer-events:none;font-size:24px;';
        el.textContent   = entity.speciesDef?.emoji ?? '?';
        entity.element   = el;
        return el;
    }

    _syncElement(entity, el) {
        // Entities expose syncToDOM() for custom sync (stat bars, class toggles, etc.)
        // and the RenderSystem handles the universal position update.
        el.style.left = entity.x + 'px';
        el.style.top  = entity.y + 'px';

        if (typeof entity.syncToDOM === 'function') {
            entity.syncToDOM(el);
        }
    }

    // ── Particle helpers (live here, not in entity classes) ──────────────────

    createSplash(x, y, pool) {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                const p = pool.get('splash');
                p.element.textContent = '💧';
                p.element.style.cssText +=
                    `font-size:16px;left:${x + (Math.random() - 0.5) * 30}px;` +
                    `top:${y}px;animation:splashFloat 0.8s ease-out forwards`;
                setTimeout(() => pool.release(p), 800);
            }, i * 50);
        }
    }

    createHearts(x, y, pool) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const p = pool.get('heart');
                p.element.textContent = '💕';
                p.element.style.cssText +=
                    `font-size:20px;left:${x + (Math.random() - 0.5) * 30}px;` +
                    `top:${y - 20}px;animation:splashFloat 1.5s ease-out forwards`;
                setTimeout(() => pool.release(p), 1500);
            }, i * 200);
        }
    }
}
