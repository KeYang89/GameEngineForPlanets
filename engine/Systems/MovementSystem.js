// engine/Systems/MovementSystem.js
// Drives autonomous movement (wander + bounce) for fish, sea creatures,
// and marine mammals. Birds and shrimp have their own physics handled
// inside their entity classes, but this system handles the shared
// moveFreely / wander pattern used by FishEntity and MammalEntity.

export class MovementSystem {
    constructor(world, entities) {
        this.world    = world;
        this.entities = entities; // EntityManager
    }

    update(dt) {
        if (this.world.isPaused) return;

        const pools = [
            ...this.entities.fish,
            ...this.entities.seaCreatures,
            ...this.entities.octopi,
        ];

        for (const e of pools) {
            if (!e._usesMovementSystem) continue; // opt-in flag
            this._wander(e);
            this._moveFreely(e, dt);
        }
    }

    _wander(e, probability = 0.02) {
        if (Math.random() < probability)
            e.direction += (Math.random() - 0.5) * Math.PI / 4;
    }

    _moveFreely(e, dt, speedMultiplier = 1) {
        const w = this.world;
        const spd = e.speed * dt * 25 * speedMultiplier;
        e.x += Math.cos(e.direction) * spd;
        e.y += Math.sin(e.direction) * spd;

        // Bounce off ocean walls
        if (e.x < 0 || e.x > w.width - 50)       e.direction = Math.PI - e.direction;
        if (e.y < w.oceanTop || e.y > w.height - 50) e.direction = -e.direction;
    }
}
