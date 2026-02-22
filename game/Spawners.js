// game/Spawners.js
// Public API for creating entities. All spawn logic lives here —
// entities never construct siblings or children directly.
// Spawners listens to bus events (EGG_HATCHED, ELIXIR_OPENED) and
// reacts by spawning offspring or cleaning up pollution.

import { SPECIES }     from './SpeciesRegistry.js';
import { Events }      from '../engine/EventBus.js';
import { BirdEntity }  from './Entities/Bird.js';
import { FishEntity }  from './Entities/Fish.js';
import { MammalEntity }from './Entities/Mammal.js';
import { AlgaeEntity } from './Entities/Algae.js';

// Static entities imported inline to avoid circular deps
// (Island, Egg, Elixir are defined below as lightweight classes)

export class Spawners {
    constructor(world, entities, bus) {
        this.world    = world;
        this.entities = entities;
        this.bus      = bus;
        this.ui       = null;

        // Listen to events that trigger spawn side-effects
        bus.on(Events.EGG_HATCHED,    p => { if (p.create) this.createEgg(p.x, p.y, p.parentColor); });
        bus.on(Events.ELIXIR_OPENED,  p => this._onElixirOpened(p));
        bus.on(Events.LOG_EVENT,       p => this.ui?.logEvent(p.message));
        bus.on(Events.HUD_REFRESH,     ()  => this.ui.updateHUD(true));
    }

    setUI(ui) {
        this.ui = ui;
    }

    // ── Birds ─────────────────────────────────────────────────────────────────

    addBird(speciesDef = SPECIES.birds.MALLARD) {
        if (!this.entities.canSpawn(speciesDef)) {
            this.ui?.logEvent(`Max ${speciesDef.name} reached (${speciesDef.MAX_COUNT})! 🦆`); return;
        }
        const w = this.world;
        let x, y, valid = false, attempts = 0;
        const waterMin = w.height * 0.35, waterMax = w.height * 0.45;
        while (!valid && attempts < 30) {
            x = Math.random() * (w.width - 100);
            y = waterMin + Math.random() * (waterMax - waterMin);
            valid = this.entities.ducks.every(d => _dist(x, y, d.x, d.y) > 80);
            attempts++;
        }
        const duck = new BirdEntity(this.entities.nextDuckId++, x, y, speciesDef);
        this.entities.add(duck, 'ducks', true);
        this.ui?.logEvent(`New ${duck.personality} ${speciesDef.name} #${duck.id} joined the pond!`);
        return duck;
    }

    // ── Fish / Sea Creatures ──────────────────────────────────────────────────

    spawnFish(speciesDef, x, y) {
        if (!this.entities.canSpawn(speciesDef)) {
            this.ui?.logEvent(`Max ${speciesDef.name} reached (${speciesDef.MAX_COUNT})!`); return null;
        }
        const entity = new FishEntity(this.entities.nextFishId++, x, y, speciesDef);
        const mainFish = [SPECIES.fish.SALMON.id, SPECIES.fish.TROPICAL.id,
                          SPECIES.fish.PUFFER.id, SPECIES.fish.SHARK.id];
        if (speciesDef.isOctopus) {
            this.entities.add(entity, 'octopi');
        } else if (mainFish.includes(speciesDef.id)) {
            this.entities.add(entity, 'fish', true);
        } else {
            this.entities.add(entity, 'seaCreatures', true);
        }
        return entity;
    }

    addFish(speciesDef = SPECIES.fish.SALMON) {
        return this.spawnFish(speciesDef,
            this.world.randomOceanX(), this.world.randomOceanY());
    }

    addOctopus() {
        return this.spawnFish(SPECIES.fish.OCTOPUS,
            this.world.randomOceanX(), this.world.randomOceanY());
    }

    // ── Mammals ───────────────────────────────────────────────────────────────

    addPredator(speciesDef = null) {
        if (this.entities.islands.length === 0) { this.ui?.logEvent('Need an island first! 🏝️'); return; }
        const island = this.entities.islands[Math.floor(Math.random() * this.entities.islands.length)];
        const def = speciesDef ?? (Math.random() < 0.5 ? SPECIES.mammals.CAT : SPECIES.mammals.DOG);
        if (!this.entities.canSpawn(def)) { this.ui?.logEvent(`Max ${def.name} reached!`); return; }
        const off = island.size === 'small' ? 45 : island.size === 'medium' ? 70 : 90;
        const p = new MammalEntity(
            this.entities.nextPredatorId++,
            island.x + off + (Math.random() - 0.5) * 30,
            island.y + off + (Math.random() - 0.5) * 30,
            def, island
        );
        this.entities.add(p, 'predators');
        this.ui?.logEvent(`${def.name} #${p.id} appeared on Island #${island.id}!`);
        return p;
    }

    spawnSeaCreature(speciesDef, x, y) {
        if (!this.entities.canSpawn(speciesDef)) return null;
        const entity = new MammalEntity(this.entities.nextCreatureId++, x, y, speciesDef);
        this.entities.add(entity, 'seaCreatures', true);
        return entity;
    }

    addSeaCreature(speciesDef = null) {
        const def = speciesDef ?? (() => {
            const opts = Object.values(SPECIES.mammals).filter(m => !m.isPredator && !m.onIsland);
            return opts[Math.floor(Math.random() * opts.length)];
        })();
        if (!this.entities.canSpawn(def)) { this.ui?.logEvent(`Max ${def.name} reached!`); return; }
        const entity = new MammalEntity(
            this.entities.nextCreatureId++,
            this.world.randomOceanX(), this.world.randomOceanY(), def
        );
        this.entities.add(entity, 'seaCreatures', true);
        this.ui?.logEvent(`${def.name} #${entity.id} appeared! ${def.emoji}`);
        return entity;
    }

    // ── Prey / Shrimp ─────────────────────────────────────────────────────────

    addFood(speciesDef = SPECIES.prey.SHRIMP) {
        if (!this.entities.canSpawn(speciesDef)) return;
        const shrimp = new PreyEntity(this.entities.nextFoodId++,
            this.world.randomOceanX(), 50, speciesDef, true);
        this.entities.add(shrimp, 'food');
        return shrimp;
    }

    addFoodAt(x, y, shouldFall = false) {
        if (!this.entities.canSpawn(SPECIES.prey.SHRIMP)) return;
        const s = new PreyEntity(this.entities.nextFoodId++, x, y, SPECIES.prey.SHRIMP, shouldFall);
        if (!shouldFall) {
            s.hasEnteredWater = true;
            this.entities.grids.food.add(s);
        }
        this.entities.add(s, 'food');
        return s;
    }

    spawnBabyShrimp(x, y) {
        if (!this.entities.canSpawn(SPECIES.prey.SHRIMP_B)) return null;
        const ot = this.world.oceanTop;
        const baby = new PreyEntity(this.entities.nextFoodId++,
            x, Math.max(ot + 10, y), SPECIES.prey.SHRIMP_B, false);
        baby.hasEnteredWater = true;
        baby.element?.classList.add('swimming');
        this.entities.add(baby, 'food', true);
        return baby;
    }

    addBabyShrimp(x, y) { return this.spawnBabyShrimp(x, y); }

    // ── Algae ─────────────────────────────────────────────────────────────────

    addAlgae(type = null) {
        let def;
        if (type === 'toxic')    def = SPECIES.algae.TOXIC;
        else if (type === 'kelp')     def = SPECIES.algae.KELP;
        else if (type === 'seagrass') def = SPECIES.algae.SEAGRASS;
        else {
            const creatureCount = this.entities.ducks.length + this.entities.fish.length;
            def = Math.random() < Math.min(0.7, creatureCount * 0.05)
                ? SPECIES.algae.TOXIC : SPECIES.algae.HEALTHY;
        }
        if (!this.entities.canSpawn(def)) return;
        const entity = new AlgaeEntity(this.entities.nextAlgaeId++,
            this.world.randomOceanX(), this.world.randomOceanY(0.5), def);
        if (def.isSeagrass) this.entities.add(entity, 'seagrass');
        else if (def.isKelp) this.entities.add(entity, 'kelp');
        else                  this.entities.add(entity, 'algae');
        return entity;
    }

    addKelp() {
        if (!this.entities.canSpawn(SPECIES.algae.KELP)) return;
        const entity = new AlgaeEntity(this.entities.nextKelpId++,
            this.world.randomOceanX(), this.world.oceanTop + 10, SPECIES.algae.KELP);
        this.entities.add(entity, 'kelp');
        return entity;
    }

    addSeagrass(nearIsland = null) {
        if (!this.entities.canSpawn(SPECIES.algae.SEAGRASS)) return;
        const w = this.world;
        let x = this.world.randomOceanX(20);
        if (nearIsland) {
            const off  = nearIsland.size === 'small' ? 45 : nearIsland.size === 'medium' ? 70 : 90;
            const base = nearIsland.size === 'small' ? 50 : nearIsland.size === 'medium' ? 80 : 110;
            const angle = Math.random() * Math.PI * 2;
            const dist  = base + 20 + Math.random() * 100;
            x = Math.max(10, Math.min(nearIsland.x + off + Math.cos(angle) * dist, w.width - 20));
        }
        const entity = new AlgaeEntity(this.entities.nextSeagrassId++,
            x, w.oceanTop + 10, SPECIES.algae.SEAGRASS);
        this.entities.add(entity, 'seagrass');
        return entity;
    }

    // ── Islands, Eggs, Elixirs ────────────────────────────────────────────────

    addIsland(size = null) {
        const w = this.world;
        if (this.entities.islands.length >= 8) return;
        if (!size) { const r = Math.random(); size = r < 0.3 ? 'small' : r < 0.65 ? 'medium' : 'large'; }
        const iw  = size === 'small' ? 90 : size === 'medium' ? 140 : 180;
        const sep = size === 'small' ? 150 : size === 'medium' ? 200 : 250;
        let x, y, valid = false, attempts = 0;
        while (!valid && attempts < 50) {
            x = Math.random() * (w.width - iw - 20) + 10;
            y = w.oceanTop + Math.random() * (w.height * 0.25);
            const co = size === 'small' ? 45 : size === 'medium' ? 70 : 90;
            valid = this.entities.islands.every(ei => {
                const eco = ei.size === 'small' ? 45 : ei.size === 'medium' ? 70 : 90;
                return _dist(x + co, y + co, ei.x + eco, ei.y + eco) >= sep;
            });
            attempts++;
        }
        if (!valid) { this.ui?.logEvent('⚠️ Not enough space for a new island'); return; }
        const island = new Island(this.entities.nextIslandId++, x, y, size);
        this.entities.add(island, 'islands');
        const gc = size === 'small' ? 2 : size === 'medium' ? 3 : 4;
        for (let i = 0; i < gc; i++) setTimeout(() => this.addSeagrass(island), i * 300);
        this.ui?.logEvent(`${size.charAt(0).toUpperCase() + size.slice(1)} Island #${island.id} appeared! 🏝️`);
        return island;
    }

    createEgg(x, y, parentColor) {
        const egg = new Egg(this.entities.nextEggId++, x, y, parentColor, this.entities, this.bus);
        this.entities.add(egg, 'eggs');
        return egg;
    }

    addElixir() {
        const w = this.world;
        const elixir = new Elixir(this.entities.nextElixirId++,
            Math.random() * (w.width - 50), 50, w.oceanTop);
        this.entities.add(elixir, 'elixirs');
        this.ui?.logEvent('Added water purification elixir ⚗️');
        return elixir;
    }

    // ── Elixir effect ─────────────────────────────────────────────────────────

    _onElixirOpened({ elixir }) {
        // Clear toxic algae, purify water, add seagrass
        [...this.entities.algae].filter(a => a.speciesDef.toxic)
            .forEach(a => this.entities.queueRemove(a));
        this.entities.waterPollution = Math.max(0, this.entities.waterPollution - 40);
        for (let i = 0; i < 3; i++) setTimeout(() => this.addSeagrass(), i * 200);
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// ── Static Entities (Island, Egg, Elixir, Prey) ───────────────────────────────
// These are small enough to live in this file and are only constructed by Spawners.

class Island {
    constructor(id, x, y, size) {
        this.id = id; this.x = x; this.y = y; this.size = size;
        this.element = this.createElement();
    }
    createElement() {
        const island = document.createElement('div');
        island.className = 'island fade-in';
        island.style.left = this.x + 'px';
        island.style.top  = this.y + 'px';
        let fontSize, grassCount, grassHeight, baseWidth, baseHeight;
        switch (this.size) {
            case 'small':  fontSize =  80; grassCount = 4; grassHeight = 20; baseWidth = 270; baseHeight = 180; break;
            case 'medium': fontSize = 100; grassCount = 5; grassHeight = 25; baseWidth = 420; baseHeight = 280; break;
            case 'large':  fontSize = 120; grassCount = 6; grassHeight = 30; baseWidth = 540; baseHeight = 360; break;
        }
        const baseOffsetX = (baseWidth  - fontSize) / 2;
        const baseOffsetY = (baseHeight - fontSize) / 2 - 20;
        let grassHTML = '';
        for (let i = 0; i < grassCount; i++) {
            const px = Math.random() * grassHeight, py = Math.random() * grassHeight;
            grassHTML += `<div class="grass-blade-group" style="height:${grassHeight}px;top:${py}px;left:${px}px"><div class="grass-blade"></div><div class="grass-blade"></div><div class="grass-blade"></div></div>`;
        }
        const blobs = [
            'M12.2,-20.1C16.1,-18.9,19.8,-16.2,22.9,-12.6C26,-9.1,28.5,-4.5,28.1,-0.2C27.7,4.1,24.4,8.1,23,14.7C21.6,21.2,22.1,30.1,18.6,33.6C15.1,37,7.5,34.9,1,33.2C-5.5,31.5,-11.1,30.2,-15.8,27.4C-20.5,24.6,-24.3,20.4,-28,15.6C-31.7,10.8,-35.4,5.4,-36.1,-0.4C-36.9,-6.3,-34.8,-12.6,-28.4,-12.8C-22.1,-13.1,-11.5,-7.3,-6.1,-7.7C-0.6,-8,-0.3,-14.4,1.9,-17.7C4.1,-21,8.3,-21.3,12.2,-20.1Z',
            'M10.5,-13.7C15.8,-15.1,23.8,-16.7,28,-14.5C32.2,-12.3,32.5,-6.1,32.3,-0.1C32.1,5.9,31.4,11.8,28.8,16.8C26.3,21.8,21.8,25.9,16.7,29C11.5,32,5.8,34.1,2.9,29.1C-0.1,24.2,-0.1,12.3,-6.1,9.7C-12.2,7.2,-24.1,14,-27.7,13.9C-31.2,13.9,-26.2,6.9,-24.4,1.1C-22.5,-4.8,-23.7,-9.6,-20.5,-10.3C-17.4,-11,-9.9,-7.6,-5.8,-7C-1.6,-6.3,-0.8,-8.3,0.9,-9.8C2.6,-11.3,5.2,-12.4,10.5,-13.7Z',
            'M16.8,-27.7C22,-26.1,26.6,-22,31.6,-17C36.6,-12,42.1,-6,42.4,0.1C42.7,6.3,37.7,12.6,33.3,18.8C29,25,25.3,31.2,19.8,34.6C14.4,38.1,7.2,38.8,-0.3,39.4C-7.8,39.9,-15.6,40.3,-20.5,36.5C-25.4,32.7,-27.4,24.8,-28.7,18.1C-30,11.3,-30.6,5.7,-26.7,2.3C-22.8,-1.1,-14.4,-2.3,-10.8,-5.1C-7.2,-7.9,-8.4,-12.3,-7.5,-16.4C-6.5,-20.4,-3.2,-24,1.3,-26.2C5.8,-28.4,11.6,-29.3,16.8,-27.7Z',
        ];
        island.innerHTML = `
            <svg class="island-sand-base" viewBox="0 0 100 100" width="${baseWidth}" height="${baseHeight}"
                 style="position:absolute;left:-${baseOffsetX}px;top:-${baseOffsetY}px;z-index:5;" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="sg-${this.id}" x1="0" x2="1" y1="1" y2="0">
                        <stop stop-color="#e8c48a" offset="0%"/><stop stop-color="#f4d6a3" offset="100%"/>
                    </linearGradient>
                </defs>
                <path fill="url(#sg-${this.id})" d="${blobs[(this.id - 1) % 3]}" transform="translate(50 50)"
                      stroke="#d4b896" stroke-width="0.5" opacity="0.95"/>
            </svg>
            <div class="island-base" style="font-size:${fontSize}px;position:relative;z-index:10;">🌴</div>
            <div class="island-grass" style="z-index:6;">${grassHTML}</div>`;
        document.getElementById('game-container').appendChild(island);
        return island;
    }
    isPointOnIsland(x, y) {
        const off = this.size === 'small' ? 45 : this.size === 'medium' ? 70 : 90;
        const rad = this.size === 'small' ? 40 : this.size === 'medium' ? 65 : 85;
        return _dist(x, y, this.x + off, this.y + off) < rad;
    }
    update() {}   // static — no-op
    destroy() { this.element?.remove(); }
}

class Egg {
    constructor(id, x, y, parentColor, entities, bus) {
        this.id = id; this.x = x; this.y = y;
        this.parentColor = parentColor;
        this.entities = entities;
        this.bus = bus;
        this.hatchTime = 15;
        this.element = this.createElement();
    }
    createElement() {
        const el = document.createElement('div');
        el.className = 'egg fade-in';
        el.style.left = this.x + 'px';
        el.style.top  = this.y + 'px';
        el.innerHTML = '🥚'; el.title = 'Click to hatch!';
        el.addEventListener('click', () => this.hatch());
        document.getElementById('game-container').appendChild(el);
        return el;
    }
    update(dt) {
        this.hatchTime -= dt;
        if (this.hatchTime <= 0) this.hatch();
    }
    hatch() {
        if (this._hatching) return;
        this._hatching = true;
        this.element?.classList.add('hatching');
        setTimeout(() => {
            if (!this.entities.canSpawn(SPECIES.birds.MALLARD)) {
                this.entities.queueRemove(this); return;
            }
            const duck = new BirdEntity(this.entities.nextDuckId++, this.x, this.y,
                SPECIES.birds.MALLARD, this.parentColor);
            this.entities.add(duck, 'ducks', true);
            this.bus.emit(Events.LOG_EVENT,
                { message: `🐣 An egg hatched! Welcome ${duck.color.name} ${duck.gender === 'M' ? '♂️' : '♀️'} ${duck.speciesDef.name} #${duck.id}!` });
            this.entities.queueRemove(this);
        }, 800);
    }
    destroy() { this.element?.remove(); }
}

class Elixir {
    constructor(id, x, y, targetY) {
        this.id = id; this.x = x; this.y = y;
        this.falling  = true;
        this.velocity = 0;
        this.gravity  = 150;
        this.targetY  = targetY + 20;
        this.element  = this.createElement();
    }
    createElement() {
        const el = document.createElement('div');
        el.className = 'elixir fade-in';
        el.style.left = this.x + 'px';
        el.style.top  = this.y + 'px';
        el.innerHTML = '⚗️';
        return el;
    }
    update(dt) {
        if (this.falling && this.y < this.targetY) {
            this.velocity += this.gravity * dt;
            this.y += this.velocity * dt;
            if (this.y >= this.targetY) { this.y = this.targetY; this.falling = false; this.velocity = 0; }
            this.element.style.left = this.x + 'px';
            this.element.style.top  = this.y + 'px';
        }
    }
    destroy() { this.element?.remove(); }
}

class PreyEntity {
    constructor(id, x, y, speciesDef, shouldFall = true) {
        this.id          = id; this.x = x; this.y = y;
        this.speciesDef  = speciesDef;
        this.age         = 0;
        this.lifetime    = speciesDef.maxAge * 1000;
        this.hunger      = 50;
        this.reproductionCooldown = 15;
        this.isFalling   = shouldFall;
        this.velocityY   = 0;
        this.gravity     = 300;
        this.hasEnteredWater = false;
        this.swimDirection   = Math.random() * Math.PI * 2;
        this.swimSpeed       = 0.3 + Math.random() * 0.2;
        this.dead            = false;
        this.element         = this.createElement();
        if (this.isFalling) this.element.classList.add('falling');
    }
    createElement() {
        const el = document.createElement('div');
        el.className = 'food-item fade-in';
        el.style.left     = this.x + 'px';
        el.style.top      = this.y + 'px';
        el.style.fontSize = this.speciesDef.size + 'px';
        el.innerHTML      = this.speciesDef.emoji;
        return el;
    }
    update(dt, world, entities) {
        this.age += dt;

        // Grow baby into adult
        if (this.speciesDef.isBaby && this.age >= 10) {
            this.speciesDef = SPECIES.prey.SHRIMP;
            this.element.style.fontSize = this.speciesDef.size + 'px';
        }

        const ot = world.oceanTop;
        if (this.isFalling) {
            this.velocityY += this.gravity * dt;
            this.y += this.velocityY * dt;
            if (this.y >= ot && !this.hasEnteredWater) {
                this.hasEnteredWater = true;
                this.isFalling = false;
                this.velocityY = 0;
                this.y = ot + 10;
                entities.grids.food.add(this);
                // Particle splash emitted via bus
                this.element.classList.remove('falling');
                this.element.classList.add('swimming');
            }
            this.element.style.top = this.y + 'px';
            return;
        }

        if (this.hasEnteredWater) {
            const oldX = this.x, oldY = this.y;
            if (Math.random() < 0.02) this.swimDirection += (Math.random() - 0.5) * Math.PI / 3;
            const spd = this.swimSpeed * dt * 25;
            this.x += Math.cos(this.swimDirection) * spd;
            this.y += Math.sin(this.swimDirection) * spd;
            entities.grids.food.update(this, oldX, oldY);
            if (this.x < 0 || this.x > world.width - 30)  this.swimDirection = Math.PI - this.swimDirection;
            if (this.y < ot || this.y > world.height - 30) this.swimDirection = -this.swimDirection;
            this.element.style.left      = this.x + 'px';
            this.element.style.top       = this.y + 'px';
            this.element.style.transform = Math.cos(this.swimDirection) < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        }

        this.lifetime -= dt * 1000;
        this.hunger = Math.max(0, this.hunger - dt * 0.5);
        this.reproductionCooldown = Math.max(0, this.reproductionCooldown - dt);

        // Eat nearby algae
        if (Math.random() < 0.02) {
            for (const a of entities.algae) {
                const dx = a.x - this.x, dy = a.y - this.y;
                if (dx * dx + dy * dy < 50 * 50) {
                    this.hunger = Math.min(100, this.hunger + 25);
                    this.lifetime += 5000;
                    entities.queueRemove(a);
                    break;
                }
            }
        }

        if (this.lifetime <= 0) this.dead = true;
    }
    destroy() { this.element?.remove(); }
    distanceTo(obj) {
        const dx = (obj.x ?? 0) - this.x, dy = (obj.y ?? 0) - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
