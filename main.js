// main.js
// Entry point for Sea of Ducks.
// Wires the engine, world, entity manager, systems, UI, and spawners together.
// This is the only file that imports everything — all other files import only
// what they strictly need.

import { Engine }              from './engine/Core.js';
import { World }               from './engine/World.js';
import { EntityManager }       from './engine/EntityManager.js';
import { EventBus, Events }    from './engine/EventBus.js';
import { MovementSystem }      from './engine/Systems/MovementSystem.js';
import { AISystem }            from './engine/Systems/AISystem.js';
import { ReproductionSystem }  from './engine/Systems/ReproductionSystem.js';
import { RenderSystem }        from './engine/Systems/RenderSystem.js';
import { PollutionSystem }     from './engine/Systems/PollutionSystem.js';

import { CONFIG }              from './game/GameConfig.js';
import { GameUI }              from './game/GameUI.js';
import { Spawners }            from './game/Spawners.js';
import { SPECIES }             from './game/SpeciesRegistry.js';
import { UFOSequence }         from './game/UFOSequence.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const container = document.getElementById('game-container');

// Core engine objects
const bus      = new EventBus();
const world    = new World(CONFIG);
const entities = new EntityManager(bus, CONFIG);
const engine   = new Engine({ targetFPS: CONFIG.UPDATE_FPS });

world.init(container);

// Game-layer objects
const spawners = new Spawners(world, entities, bus);
const ui       = new GameUI(world, entities, bus, CONFIG);
spawners.setUI(ui); // inject it after both are created

// ── Register systems (execution order matters) ────────────────────────────────

// 1. Flush removal queue from last frame before anyone reads arrays
engine.addSystem({
    update: ()  => entities.flushRemovals(),
});

// 2. AI decisions (low frequency — entities throttle internally)
engine.addSystem(new AISystem(world, entities, bus));

// 3. Movement
engine.addSystem(new MovementSystem(world, entities));

// 4. Reproduction (pair-finding for fish/mammals/shrimp)
engine.addSystem(new ReproductionSystem(world, entities, bus, spawners));

// 5. Pollution + algae lifetime
engine.addSystem(new PollutionSystem(world, entities, bus));

// 6. Per-entity update() — aging, behaviour execution, shrimp physics
engine.addSystem({
    update: (dt) => {
        if (world.isPaused) return;
        const allArrays = [
            entities.ducks, entities.fish, entities.food, entities.eggs,
            entities.algae, entities.seagrass, entities.kelp,
            entities.octopi, entities.elixirs, entities.seaCreatures, entities.predators,
        ];
        for (const arr of allArrays)
            for (let i = arr.length - 1; i >= 0; i--)
                arr[i]?.update(dt, world, entities, bus, CONFIG);

        // Mark dead entities for removal
        for (const arr of allArrays)
            for (const e of arr)
                if (e.dead) entities.queueRemove(e);
    },
});

// 7. Natural algae spawning
let algaeTimer = 0;
engine.addSystem({
    update: (dt) => {
        if (world.isPaused) return;
        algaeTimer += dt;
        if (algaeTimer >= CONFIG.ALGAE_SPAWN_INTERVAL) {
            algaeTimer = 0;
            spawners.addAlgae();
        }
    },
});

// 8. Day/night
engine.addSystem({
    update: (dt) => {
        if (world.isPaused) return;
        const flipped = world.tick(dt);
        if (flipped) bus.emit(Events.DAY_NIGHT_FLIP);
    },
});

// 9. Render — always runs even when paused so the screen stays current
engine.addSystem(new RenderSystem(world, entities, container));

// 10. UI / HUD
engine.addSystem(ui);

// 11. UFO — ticks the active sequence, and auto-triggers when biodiversity > 70%
let ufoCheckCooldown = 10;  // prevents re-triggering immediately after a visit

engine.addSystem({
    update: (dt) => {
        UFOSequence.update(dt);

        // Auto-trigger check (runs every 5s to avoid checking every frame)
        ufoCheckCooldown -= dt;
        if (ufoCheckCooldown > 0) return;
        ufoCheckCooldown = 5;

        if (!UFOSequence._active && entities.biodiversity > 70) {
            UFOSequence.trigger(container, world, entities, bus);
            ufoCheckCooldown = 120;  // 2 min cooldown after each visit
        }
    },
});

// ── Wire up button handlers ───────────────────────────────────────────────────

// These are called by onclick= attributes in index.html.
// We attach them to window so index.html can reach them.
window.gameActions = {
    addBird:         (def)  => spawners.addBird(def ? SPECIES.birds[def] : undefined),
    addFish:         (id)   => {
        const def = Object.values(SPECIES.fish).find(s => s.id === id) ?? SPECIES.fish.SALMON;
        spawners.addFish(def);
    },
    addFood:         ()     => spawners.addFood(),
    addOctopus:      ()     => spawners.addOctopus(),
    addSeaCreature:  ()     => spawners.addSeaCreature(),
    addPredator:     ()     => spawners.addPredator(),
    addIsland:       ()     => spawners.addIsland(),
    addElixir:       ()     => spawners.addElixir(),
    addKelp:         ()     => spawners.addKelp(),
    addAlgae:        (type) => spawners.addAlgae(type),
    togglePause:     (btn)  => ui.togglePause(btn),
    toggleHUD:       ()     => ui.toggleHUD(),
    toggleLog:       ()     => ui.toggleLog(),
    triggerUFO:      ()     => UFOSequence.trigger(container, world, entities, bus),
};

// Allow index.html to drop food at click position
container.addEventListener('click', (e) => {
    if (e.target !== container) return; // don't steal clicks from entities
    const rect = container.getBoundingClientRect();
    spawners.addFoodAt(e.clientX - rect.left, e.clientY - rect.top);
});

// ── Initial scene setup ───────────────────────────────────────────────────────

ui.createStars();

spawners.addIsland('medium');
spawners.addIsland('small');

for (let i = 0; i < 4; i++) spawners.addBird();
for (let i = 0; i < 3; i++) spawners.addFish();
for (let i = 0; i < 2; i++) spawners.addFood();

spawners.addOctopus();
spawners.addSeaCreature();
spawners.addKelp();
spawners.addAlgae('seagrass');

ui.updateHUD(true);
ui.updateDayNight();

// ── Go! ───────────────────────────────────────────────────────────────────────

engine.start();
