// engine/EventBus.js
// Tiny pub/sub bus. Keeps systems and entities decoupled.

export class EventBus {
    constructor() { this._map = new Map(); }

    /** Subscribe. Returns an unsubscribe fn. */
    on(event, cb) {
        if (!this._map.has(event)) this._map.set(event, []);
        this._map.get(event).push(cb);
        return () => this.off(event, cb);
    }

    off(event, cb) {
        const list = this._map.get(event);
        if (!list) return;
        const i = list.indexOf(cb);
        if (i > -1) list.splice(i, 1);
    }

    emit(event, payload = {}) {
        const list = this._map.get(event);
        if (list) for (const cb of list) cb(payload);
    }

    clear() { this._map.clear(); }
}

// Named event constants — use these everywhere to avoid string typos.
export const Events = {
    // Entity lifecycle
    ENTITY_SPAWNED:    'entity:spawned',
    ENTITY_REMOVED:    'entity:removed',
    EGG_HATCHED:       'egg:hatched',
    SHRIMP_SPLASHED:   'shrimp:splashed',
    ELIXIR_OPENED:     'elixir:opened',

    // Gameplay
    DUCK_EATEN:        'duck:eaten',
    FISH_EATEN:        'fish:eaten',
    FOOD_EATEN:        'food:eaten',

    // Environment
    POLLUTION_CHANGED: 'env:pollutionChanged',
    DAY_NIGHT_FLIP:    'env:dayNightFlip',

    // UI signals
    LOG_EVENT:         'ui:log',
    HUD_REFRESH:       'ui:hudRefresh',
};
