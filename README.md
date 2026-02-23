# 🌊 Sea of Ducks

> *A living ecosystem engine — from Earth's oceans to the alien waters of various planets.*

---

## What is this?

Sea of Ducks is a **browser-based ecosystem simulation engine** built around one idea: life finds a way, wherever water exists. You watch species feed, breed, compete, and die — on Earth, and eventually on worlds that have never seen a duck before.

The engine is designed to be planet-agnostic. Earth is just the first biome. Drop the same engine on a new planet config and a completely different ecosystem emerges.

---

## 🎮 Features

- **Living ecosystem** — ducks hunt, rest, socialise, lay eggs, and age in real time
- **Full food chain** — shrimp → fish → birds → predators, with algae driving the base of the chain
- **Water pollution system** — toxic algae spreads, elixirs purify, biodiversity reacts
- **Day / night cycle** — behaviour and atmosphere shift with the light
- **Island generation** — procedural sand blobs with grass, each hosting its own predator territory
- **Spatial partitioning** — quad-grid proximity queries keep large populations fast
- **🛸UFO** — something happens when biodiversity is over 70%. We're not saying what.

---

## 🌍 Planets

### Earth — *Sol III, Class-M Ocean World*
The home biome. Temperate sky, blue ocean, sandy islands. Species include mallards, swans, flamingos, geese, pelicans, salmon, sharks, dolphins, whales, crabs, octopi, and shrimp.

### 🪐 Other planets — *Class-M Alien Ocean World*
A distant world with a violet sky, twin moons, and a bioluminescent teal ocean. The shoreline is thick with alien flora. No native species have been catalogued — yet. Biological samples collected from Earth have been introduced into the water. What happens next is up to the engine.

> *More planets are possible. Each needs a sky gradient, an ocean colour, a flora palette, and a species table. The engine handles the rest.*

---

## 🌍 Generate Your Own World

Sea of Ducks ships with **genWorld** — a standalone planet generator that lets you design a custom world from scratch and watch its civilizations evolve in real time.

Open `genWorld.html` in any browser (no server required — it's fully self-contained).

### What you configure

| Setting | Options |
|---|---|
| **Planet name** | Free text — name it anything |
| **Dominant biome** | Temperate · Desert · Ocean · Jungle · Arctic · Volcanic · Crystal · Void |
| **Landmass coverage** | 10–90% — controls how much land vs ocean is generated |
| **Civilizations** | Up to 8 — name each one, pick a color, assign a trait |
| **Civ traits** | Aggressive · Maritime · Arcane · Naturalist · Nomadic · Merchant · Scholar · Theocratic |
| **World traits** | Rivers · Trade Routes · Wonders · Plagues · Wars · Alliances · Golden Ages · Cataclysms |
| **Starting conditions** | Major Cities · Neutral Start · Hostile World · Advanced Tech · Sparse Population |
| **Simulation speed** | 1× – 5× |

### What gets generated

- Procedural blob-shaped continents with biome-specific textures and color palettes
- Rivers, coastline highlights, and ocean shimmer
- City network per civilization (capitals, major cities, towns)
- Diplomatic relations matrix — alliances, rivalries, and open wars
- Animated trade ships traveling bezier routes between friendly capitals
- Military units that patrol home territory and advance during conflicts
- Historical age progression: Dawn Age → Stone → Bronze → Iron → Classical → Medieval → Renaissance → Industrial → Enlightened
- A live **World Chronicle** event log tracking wars declared, cities founded, wonders completed, plagues, golden ages, and cataclysms

### How to use it

```bash
# No server needed — just open directly
open genWorld.html

# Or serve alongside the main game
npx serve .
# then navigate to http://localhost:8080/genWorld.html
```

> *Every biome has its own palette. A Void world generates 300 stars and near-black terrain. A Crystal world glows in purple and indigo. Each generated planet is unique.*

---

## 🏗️ Architecture

The codebase is split into two clean layers: a **reusable engine** and a **game layer** specific to Sea of Ducks.

```
/engine                     ← planet-agnostic, reusable
    Core.js                 ← fixed-timestep game loop
    World.js                ← geometry, time, day/night
    EntityManager.js        ← pools, IDs, spatial grids, population caps
    SpatialGrid.js          ← uniform spatial hashing for proximity queries
    EventBus.js             ← pub/sub decoupling between all layers
    Systems/
        MovementSystem.js   ← wander + boundary bounce
        AISystem.js         ← schedules AI think() ticks
        ReproductionSystem.js ← passive pair-finding for fish, mammals, shrimp
        RenderSystem.js     ← sole owner of the DOM; entities never touch it
        PollutionSystem.js  ← algae lifetime + water quality

/game                       ← Sea of Ducks specific
    SpeciesRegistry.js      ← every species in one table, with MAX_COUNT caps
    GameConfig.js           ← all tunable constants + mobile detection
    GameUI.js               ← HUD, event log, biodiversity bar, perf display
    Spawners.js             ← only place entities are constructed
    UFOSequence.js          ← cinematic abduction + space travel + alien landing
    Entities/
        BaseEntity.js       ← movement helpers, aging, DOM interface contract
        Bird.js             ← full AI state machine (hunger / breed / social / explore)
        Fish.js             ← wander, eat algae, octopus special behaviour
        Mammal.js           ← island predators + marine mammals
        Algae.js            ← sessile plants; lifetime owned by PollutionSystem

main.js                     ← wires everything together, exposes window.gameActions
index.html                  ← shell + HUD buttons
styles.css                  ← all visual styles including cinematic sequences
```

### Engine Philosophy

The engine sits between classic OOP and ECS. Entities own their *state* and *DOM contract* (`createElement`, `syncToDOM`). Systems own *behaviour* across populations. The EventBus means nothing calls anything across layer boundaries directly — entities emit events, systems and spawners react.

This makes the engine **headless-capable**: remove `RenderSystem` and the simulation runs silently at full speed. Useful for evolution experiments, AI training, or server-side multiplayer state.

---

## 🧬 Species Registry

Every organism is a single entry in `SpeciesRegistry.js`. Adding a new species requires no code changes to any system or entity class — just a row in the table:

```js
// game/SpeciesRegistry.js
SPECIES.birds.SWAN = {
    id: 'swan', emoji: '🦢', name: 'Swan',
    speed: 1.0, maxAge: 220, size: 40, MAX_COUNT: 12
}
```

Population caps are enforced globally by `EntityManager.canSpawn()` before any entity is constructed.

---

## 🌱 Current Species

| Group | Species |
|---|---|
| **Birds** | 🦆 Mallard · 🐥 Duckling · 🦤 Pelican · 🦢 Swan · 🦩 Flamingo 
| **Fish** | 🐟 Salmon · 🐠 Tropical · 🐡 Pufferfish · 🦈 Shark · 🦑 Squid · 🦞 Lobster · 🦀 Crab · 🐚 Shell · 🐙 Octopus |
| **Mammals** | 🐬 Dolphin · 🐳 Whale · 🦭 Seal · 🦦 Otter · 🐈 Cat · 🐕 Dog |
| **Flora** | 🟢 Green Algae · 🔴 Toxic Algae · 🌿 Kelp · 🌱 Seagrass |
| **Prey** | 🦐 Shrimp · 🦐 Baby Shrimp |

---

## 🚀 Running Locally

ES modules require HTTP — open via a local server, not `file://`.

```bash
# Option A — Node
npx serve .

# Option B — Python
python3 -m http.server 8080

# Option C — VS Code
# Install "Live Server" extension, right-click index.html → Open with Live Server
```

Then open `http://localhost:8080` in any modern browser.

---

## 🔭 Roadmap
- [ ] **Genome** — add Genome to for evolution and emergence behaviors (symbosis, stealth, etc)
- [ ] **Evolution system** — traits drift across generations
- [ ] **Planet select screen** — choose your biome before the simulation starts
- [ ] **Alien native species** — organisms that evolved in the alien ocean
- [ ] **Cross-contamination events** — Earth samples mutate in alien water
- [ ] **Neural AI system** — plug in a behaviour tree or small net per species
- [ ] **Headless simulation mode** — run 10,000 ticks in the background, replay the results
- [ ] **Multiplayer world state** — server runs the engine, clients run RenderSystem only
- [ ] **More planets** — ice world, gas giant upper atmosphere, deep-sea moon


---

*The ocean remembers every species that ever touched it.*