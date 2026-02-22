// engine/EntityManager.js
// Central registry for all live entities.
// Systems read from here. Spawners write to here.
// Deferred removal prevents splice-during-iteration bugs.

import { SpatialGrid } from './SpatialGrid.js';
import { Events }      from './EventBus.js';

// Which gameState arrays feed which spatial grid
const GRID_MAP = {
    ducks:        'ducks',
    fish:         'fish',
    food:         'food',
    seaCreatures: 'creatures',
};

export class EntityManager {
    constructor(bus, config) {
        this.bus = bus;

        // ── Entity pools ────────────────────────────
        this.ducks        = [];
        this.fish         = [];
        this.food         = [];
        this.eggs         = [];
        this.algae        = [];
        this.seagrass     = [];
        this.kelp         = [];
        this.octopi       = [];
        this.elixirs      = [];
        this.islands      = [];
        this.seaCreatures = [];
        this.predators    = [];

        // ── ID counters ─────────────────────────────
        this.nextDuckId      = 1;
        this.nextFishId      = 1;
        this.nextFoodId      = 1;
        this.nextEggId       = 1;
        this.nextAlgaeId     = 1;
        this.nextSeagrassId  = 1;
        this.nextOctopusId   = 1;
        this.nextElixirId    = 1;
        this.nextIslandId    = 1;
        this.nextKelpId      = 1;
        this.nextCreatureId  = 1;
        this.nextPredatorId  = 1;

        // ── Spatial grids ────────────────────────────
        const gs = config.SPATIAL_GRID_SIZE;
        this.grids = {
            ducks:    new SpatialGrid(gs),
            fish:     new SpatialGrid(gs),
            food:     new SpatialGrid(gs),
            creatures:new SpatialGrid(gs),
        };

        // ── Deferred removal queue ───────────────────
        this._removeQueue = [];

        // ── Env state (owned here, read by Systems) ──
        this.waterPollution = 0;
        this.biodiversity   = 100;
    }

    // ── All arrays (for iteration and biodiversity scan) ──

    get allArrays() {
        return [
            this.ducks, this.fish, this.food, this.eggs,
            this.algae, this.seagrass, this.kelp,
            this.octopi, this.elixirs, this.seaCreatures, this.predators,
        ];
    }

    // ── Population cap helpers ───────────────────────

    countSpecies(speciesDef) {
        let n = 0;
        for (const arr of this.allArrays)
            for (const e of arr)
                if (e.speciesDef?.id === speciesDef.id) n++;
        return n;
    }

    canSpawn(speciesDef) {
        return this.countSpecies(speciesDef) < speciesDef.MAX_COUNT;
    }

    // ── Addition ─────────────────────────────────────

    /**
     * Add an entity to a named pool.
     * @param {object} entity
     * @param {string} poolKey  - e.g. 'ducks', 'fish', 'food'
     * @param {boolean} useGrid - whether to register in the spatial grid
     */
    add(entity, poolKey, useGrid = false) {
        this[poolKey].push(entity);
        if (useGrid && GRID_MAP[poolKey]) {
            this.grids[GRID_MAP[poolKey]].add(entity);
        }
        this.bus.emit(Events.ENTITY_SPAWNED, { entity, poolKey });
        this.bus.emit(Events.HUD_REFRESH);
    }

    // ── Removal ──────────────────────────────────────

    /** Queue removal — safe to call mid-iteration. Flushed at frame end. */
    queueRemove(entity) {
        if (!this._removeQueue.includes(entity))
            this._removeQueue.push(entity);
    }

    /** Immediate removal — avoid calling inside entity loops. */
    remove(entity) {
        const pools = [
            'ducks','fish','food','eggs','algae','seagrass','kelp',
            'octopi','elixirs','islands','seaCreatures','predators',
        ];
        for (const key of pools) {
            const arr = this[key];
            const idx = arr.indexOf(entity);
            if (idx > -1) {
                arr.splice(idx, 1);
                if (GRID_MAP[key]) this.grids[GRID_MAP[key]].remove(entity);
                entity.destroy?.();
                this.bus.emit(Events.ENTITY_REMOVED, { entity });
                this.bus.emit(Events.HUD_REFRESH);
                return;
            }
        }
    }

    /** Call at the end of each frame to process queued removals. */
    flushRemovals() {
        for (const e of this._removeQueue) this.remove(e);
        this._removeQueue.length = 0;
    }

    // ── Spatial grid helpers ─────────────────────────

    updateGrid(entity, oldX, oldY, gridKey) {
        this.grids[gridKey]?.update(entity, oldX, oldY);
    }

    getNearby(x, y, radius, gridKey) {
        return this.grids[gridKey]?.getNearby(x, y, radius) ?? [];
    }

    // ── Utility ──────────────────────────────────────

    /** Find the nearest entity in an array within maxDist. */
    static findNearest(x, y, array, maxDist = Infinity) {
        let nearest = null, best = maxDist;
        for (const obj of array) {
            const dx = obj.x - x, dy = obj.y - y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < best) { best = d; nearest = obj; }
        }
        return nearest;
    }
}
