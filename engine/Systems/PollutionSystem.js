// engine/Systems/PollutionSystem.js
// Owns the water pollution value.
// Algae tick their pollutionRate into the system each frame.
// The system also removes expired algae and clamps pollution to [0,100].

import { Events } from '../EventBus.js';

export class PollutionSystem {
    constructor(world, entities, bus) {
        this.world    = world;
        this.entities = entities;
        this.bus      = bus;
    }

    update(dt) {
        if (this.world.isPaused) return;

        let delta = 0;

        // All algae arrays contribute to pollution
        const algaePools = [
            ...this.entities.algae,
            ...this.entities.seagrass,
            ...this.entities.kelp,
        ];

        for (const a of algaePools) {
            a.lifetime -= dt;
            if (a.speciesDef?.pollutionRate !== undefined) {
                delta += a.speciesDef.pollutionRate * dt;
            }
            if (a.lifetime <= 0) {
                this.entities.queueRemove(a);
            }
        }

        // Apply and clamp
        const prev = this.entities.waterPollution;
        this.entities.waterPollution = Math.max(0, Math.min(100,
            this.entities.waterPollution + delta
        ));

        if (Math.abs(this.entities.waterPollution - prev) > 0.01) {
            this.bus.emit(Events.POLLUTION_CHANGED,
                { value: this.entities.waterPollution });
        }
    }
}
