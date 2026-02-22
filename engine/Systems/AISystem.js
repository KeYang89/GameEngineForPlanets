// engine/Systems/AISystem.js
// Drives the AI "think" tick for BirdEntity (duck/swan/goose/etc.) and
// MammalEntity predators. Entities throttle their own decisions via
// lastDecisionTime; this system just calls _think() each frame.
// Heavy decision logic lives in the entity classes themselves —
// this system is the scheduler that ensures they fire on time.

export class AISystem {
    constructor(world, entities, bus, config) {
        this.world    = world;
        this.entities = entities;
        this.bus      = bus;
        this.config   = config;
    }

    update(dt) {
        if (this.world.isPaused) return;

        const pools = [
            ...this.entities.ducks,
            ...this.entities.predators,
        ];

        for (const e of pools) {
            if (typeof e._think === 'function') e._think(this.entities, this.bus, this.config);
        }
    }
}
