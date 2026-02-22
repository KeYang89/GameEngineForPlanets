// game/Entities/Fish.js
// Covers regular fish, crustaceans, shells, squid, and octopus.
// Movement is handled here (wander + moveFreely).
// Reproduction pair-finding is handled by ReproductionSystem.
// The octopus special behaviour (elixir-seeking, duck-tickling) lives here
// because it needs direct access to entity state.


import { BaseEntity }    from './BaseEntity.js';
import { Events }        from '../../engine/EventBus.js';
import { EntityManager } from '../../engine/EntityManager.js';

// Pixels-per-second² gravity for falling crustaceans
const GRAVITY = 300;

export class FishEntity extends BaseEntity {
    constructor(id, x, y, speciesDef) {
        super(id, x, y, speciesDef);
        this.hunger               = 50 + Math.random() * 50;
        this.reproductionCooldown = 20 + Math.random() * 20;
        this.tickleCooldown       = 0;  // octopus only

        // ── Falling state (lobster / sky-drop creatures) ───────────────────
        if (speciesDef.fallsFromSky) {
            this._falling       = true;
            this._velocityY     = 0;
            this._hasEntered    = false;
        } else {
            this._falling       = false;
            this._velocityY     = 0;
            this._hasEntered    = true;
        }
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    createElement(_container) {
        const el = document.createElement('div');
        el.className = 'sea-creature fade-in';
        if (this.speciesDef.cssClass) el.classList.add(this.speciesDef.cssClass);
        el.style.left     = this.x + 'px';
        el.style.top      = this.y + 'px';
        el.style.fontSize = this.speciesDef.size + 'px';
        el.innerHTML      = this.speciesDef.emoji;
        el.title          = this.speciesDef.name;
        return el;
    }

    syncToDOM(el) {
        el.style.transform = Math.cos(this.direction) < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        if (this.age > this.maxAge * 0.8) el.style.opacity = '0.7';
    }

    // ── Update ────────────────────────────────────────────────────────────────

    update(dt, world, entities, bus) {
        if (world.isPaused) return;

        // ── Falling phase (lobster etc.) ──────────────────────────────────
        if (this._falling) {
            this._updateFalling(dt, world, bus);
            return; // skip normal AI/movement while airborne
        }

        // ── Normal fish update ────────────────────────────────────────────
        this.age += dt;
        if (this.age >= this.maxAge) {
            bus.emit(Events.LOG_EVENT, { message: `${this.speciesDef.name} #${this.id} died of old age 💀` });
            this.dead = true;
            return;
        }

        // Immobile shells just age
        if (this.speciesDef.mobile === false) return;

        this.hunger               = Math.max(0, this.hunger - dt * 0.5);
        this.reproductionCooldown = Math.max(0, this.reproductionCooldown - dt);
        if (this.tickleCooldown > 0) this.tickleCooldown -= dt;

        // Octopus special logic
        if (this.speciesDef.isOctopus) this._octopusBehaviour(dt, entities, bus);

        // Eat algae / kelp
        if (this.speciesDef.eatsAlgae && Math.random() < 0.03)
            this._tryEatAlgae(entities);

        // Autonomous movement
        this.wander();
        this.moveFreely(dt, world);
    }

    // ── Falling physics ───────────────────────────────────────────────────────

    _updateFalling(dt, world, bus) {
        const waterSurface = world.height * 0.40; // same fraction used everywhere

        // Apply gravity
        this._velocityY += GRAVITY * dt;
        this.y          += this._velocityY * dt;

        // Sync DOM manually since RenderSystem only runs after update
        if (this.element) {
            this.element.style.top  = this.y + 'px';
            this.element.style.left = this.x + 'px';
        }

        // Splash on water entry
        if (!this._hasEntered && this.y >= waterSurface) {
            this._hasEntered = true;
            this._splash(bus);
        }

        // Land at water surface + a little depth
        if (this.y >= waterSurface + 20) {
            this.y          = waterSurface + 20;
            this._falling   = false;
            this._velocityY = 0;

            // Give the entity a random swimming direction
            this.direction = Math.random() * Math.PI * 2;

            bus.emit(Events.LOG_EVENT, {
                message: `${this.speciesDef.name} #${this.id} splashed into the water! 🦞💦`,
            });
        }
    }

    _splash(bus) {
        if (!this.element) return;
        const container = this.element.parentElement;
        if (!container) return;

        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const p       = document.createElement('div');
                p.textContent = '💧';
                p.style.cssText = [
                    'position:absolute',
                    `left:${this.x + (Math.random() - 0.5) * 40}px`,
                    `top:${this.y}px`,
                    'font-size:18px',
                    'pointer-events:none',
                    'z-index:100',
                    'animation:splashFloat 0.8s ease-out forwards',
                ].join(';');
                container.appendChild(p);
                setTimeout(() => p.remove(), 800);
            }, i * 50);
        }
    }

    // ── Feeding ───────────────────────────────────────────────────────────────

    _tryEatAlgae(entities) {
        const all = [...entities.algae, ...entities.kelp];
        for (const a of all) {
            if (this.distanceTo(a) < 60) {
                this.direction = Math.atan2(a.y - this.y, a.x - this.x);
                if (this.distanceTo(a) < 30) {
                    this.hunger = Math.min(100, this.hunger + 40);
                    entities.queueRemove(a);
                    break;
                }
            }
        }
    }

    // ── Octopus ───────────────────────────────────────────────────────────────

    _octopusBehaviour(dt, entities, bus) {
        // Seek elixirs
        if (Math.random() < 0.03) {
            for (const elixir of entities.elixirs) {
                if (this.distanceTo(elixir) < 50) {
                    this.direction = Math.atan2(elixir.y - this.y, elixir.x - this.x);
                    if (this.distanceTo(elixir) < 30) {
                        this._openElixir(elixir, entities, bus);
                        break;
                    }
                }
            }
        }
        // Tickle ducks
        if (this.tickleCooldown <= 0 && Math.random() < 0.02) {
            for (const duck of entities.ducks) {
                if (this.distanceTo(duck) < 60) {
                    duck.showThought?.('Hehe! That tickles! 😆');
                    duck.social = Math.min(100, (duck.social || 0) + 10);
                    bus.emit(Events.LOG_EVENT, { message: `Octopus #${this.id} tickled ${duck.speciesDef.name} #${duck.id}! 🐙✨` });
                    this.tickleCooldown = 5;
                    break;
                }
            }
        }
    }

    _openElixir(elixir, entities, bus) {
        bus.emit(Events.LOG_EVENT, { message: `Octopus #${this.id} opened an elixir! 🐙⚗️` });
        bus.emit(Events.ELIXIR_OPENED, { elixir });
        entities.queueRemove(elixir);
    }
}
