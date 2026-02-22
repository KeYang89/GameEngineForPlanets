// game/Entities/BaseEntity.js
// Shared logic: aging, movement helpers, position sync.
// Does NOT touch gameState, global arrays, or the DOM directly.
// Rendering is handled by RenderSystem. Spawning via Spawners.

export class BaseEntity {
    constructor(id, x, y, speciesDef) {
        this.id          = id;
        this.x           = x;
        this.y           = y;
        this.speciesDef  = speciesDef;
        this.age         = 0;
        this.maxAge      = speciesDef.maxAge;
        this.speed       = (speciesDef.speed || 0) + Math.random() * 0.2;
        this.direction   = Math.random() * Math.PI * 2;
        this.element     = null;   // assigned by RenderSystem after createElement()
        this.dead        = false;  // set true to trigger removal via EntityManager
    }

    // ── Movement helpers ──────────────────────────────────────────────────────

    /**
     * Move in current direction. Bounce off ocean walls.
     * world provides width/height/oceanTop.
     */
    moveFreely(dt, world, speedMultiplier = 1) {
        const spd = this.speed * dt * 25 * speedMultiplier;
        this.x += Math.cos(this.direction) * spd;
        this.y += Math.sin(this.direction) * spd;

        if (this.x < 0 || this.x > world.width - 50)
            this.direction = Math.PI - this.direction;
        if (this.y < world.oceanTop || this.y > world.height - 50)
            this.direction = -this.direction;
    }

    wander(probability = 0.02) {
        if (Math.random() < probability)
            this.direction += (Math.random() - 0.5) * Math.PI / 4;
    }

    /**
     * Move toward a target {x, y}. Returns remaining distance.
     */
    moveTowards(target, dt, speedFactor = 1) {
        const tx = target.x ?? 0, ty = target.y ?? 0;
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            const spd = this.speed * dt * 50 * speedFactor;
            this.x += (dx / dist) * spd;
            this.y += (dy / dist) * spd;
            this.direction = Math.atan2(dy, dx);
        }
        return dist;
    }

    distanceTo(obj) {
        if (!obj) return Infinity;
        const dx = (obj.x ?? 0) - this.x;
        const dy = (obj.y ?? 0) - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ── DOM interface (called by RenderSystem) ────────────────────────────────

    /** Override in subclasses to produce the entity's HTML element. */
    createElement(_container) {
        const el = document.createElement('div');
        el.style.cssText  = 'position:absolute;font-size:' + this.speciesDef.size + 'px;';
        el.textContent    = this.speciesDef.emoji;
        return el;
    }

    /** Called every frame by RenderSystem after setting left/top. */
    syncToDOM(el) {
        const facing = Math.cos(this.direction) < 0;
        el.style.transform = facing ? 'scaleX(-1)' : 'scaleX(1)';
        if (this.age > this.maxAge * 0.8) el.style.opacity = '0.7';
    }

    destroy() {
        this.element?.remove();
        this.element = null;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /** Base tick. Subclasses should call super.update(dt) first. */
    update(dt, world, entities) {
        this.age += dt;
        if (this.age >= this.maxAge) {
            this.dead = true;
        }
    }
}
