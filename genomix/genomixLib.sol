// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title genomix
/// @notice Compact 256-bit genome encoding for on-chain creature DNA.
///         All traits are packed into a single uint256 EVM storage slot.
///
/// ┌─────────────────────────────────────────────────────────────────┐
/// │  Bit Layout (v1)                                                │
/// │  [0–15]    Species ID          → Lineage root                  │
/// │  [16–31]   Planet Origin ID    → Genesis planet                │
/// │  [32–47]   Atmosphere Adapt    → O₂ / Methane / Nitrogen       │
/// │  [48–63]   Metabolism Type     → Carbon / Silicon / Hybrid     │
/// │  [64–79]   Gravity Adaptation  → Structural density            │
/// │  [80–95]   Temperature Resist  → Cold / Hot range              │
/// │  [96–111]  Radiation Tolerance → Stellar proximity             │
/// │  [112–127] Sensory Complexity  → Vision / Echo / EM            │
/// │  [128–191] Mutation Entropy    → Evolvable randomness seed     │
/// │  [192–255] Reserved            → Future trait expansion        │
/// └─────────────────────────────────────────────────────────────────┘

library genomix {

    // ─── Bit Masks ────────────────────────────────────────────────────────────

    uint256 constant SPECIES_MASK        = 0xFFFF;
    uint256 constant PLANET_MASK         = 0xFFFF    << 16;
    uint256 constant ATMOS_MASK          = 0xFFFF    << 32;
    uint256 constant METABOLISM_MASK     = 0xFFFF    << 48;
    uint256 constant GRAVITY_MASK        = 0xFFFF    << 64;
    uint256 constant TEMP_MASK           = 0xFFFF    << 80;
    uint256 constant RADIATION_MASK      = 0xFFFF    << 96;
    uint256 constant SENSORY_MASK        = 0xFFFF    << 112;
    uint256 constant ENTROPY_MASK        = 0xFFFFFFFFFFFFFFFF << 128;
    uint256 constant RESERVED_MASK       = 0xFFFFFFFFFFFFFFFF << 192;

    // ─── Derive Genome from Planet Physics ───────────────────────────────────

    /// @notice Deterministically derives a genome from planetary parameters.
    ///         genome = keccak256(planetParams + block.timestamp + msg.sender + entropy)
    /// @param carbon       Carbon composition %  (0–100 scaled to uint16)
    /// @param silicon      Silicon composition % (0–100 scaled to uint16)
    /// @param oxygen       Oxygen %              (0–100 scaled to uint16)
    /// @param gravity      Gravity in cm/s²      (uint16)
    /// @param temperature  Temperature in K      (uint16, offset by 273 for Kelvin)
    /// @param radiation    Radiation in mSv/yr   (uint16)
    /// @param tidal        Tidal force index     (uint16)
    /// @param methane      Methane %             (uint16)
    /// @param entropy      External entropy seed (from VRF or commit-reveal)
    /// @return genome      Packed 256-bit genome
    function deriveFromPlanet(
        uint16 carbon,
        uint16 silicon,
        uint16 oxygen,
        uint16 gravity,
        uint16 temperature,
        uint16 radiation,
        uint16 tidal,
        uint16 methane,
        bytes32 entropy
    ) internal view returns (uint256 genome) {
        // Hash all planet physics + block context + entropy
        bytes32 raw = keccak256(abi.encodePacked(
            carbon, silicon, oxygen,
            gravity, temperature, radiation,
            tidal, methane,
            block.timestamp,
            msg.sender,
            entropy
        ));

        genome = uint256(raw);

        // Override atmosphere bits with physics-driven weighting
        // Higher oxygen → higher atmosphere adaptation value
        uint16 atmosVal  = uint16((uint256(oxygen)  * 655) + (uint256(methane) * 10));
        uint16 metabVal  = uint16((uint256(carbon)   * 400) + (uint256(silicon) * 255));
        uint16 gravVal   = uint16((uint256(gravity)  * 13));
        uint16 tempVal   = temperature;
        uint16 radVal    = radiation;

        genome = setSpeciesId    (genome, uint16(uint256(raw) & 0xFFFF));
        genome = setPlanetId     (genome, uint16((uint256(raw) >> 16) & 0xFFFF));
        genome = setAtmosphere   (genome, atmosVal);
        genome = setMetabolism   (genome, metabVal);
        genome = setGravity      (genome, gravVal);
        genome = setTemperature  (genome, tempVal);
        genome = setRadiation    (genome, radVal);
        genome = setSensory      (genome, uint16((uint256(raw) >> 112) & 0xFFFF));
        // Entropy seed: preserve raw hash bits 128–191

        return genome;
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    function getSpeciesId   (uint256 g) internal pure returns (uint16) { return uint16(g & SPECIES_MASK); }
    function getPlanetId    (uint256 g) internal pure returns (uint16) { return uint16((g & PLANET_MASK)     >> 16);  }
    function getAtmosphere  (uint256 g) internal pure returns (uint16) { return uint16((g & ATMOS_MASK)      >> 32);  }
    function getMetabolism  (uint256 g) internal pure returns (uint16) { return uint16((g & METABOLISM_MASK) >> 48);  }
    function getGravity     (uint256 g) internal pure returns (uint16) { return uint16((g & GRAVITY_MASK)    >> 64);  }
    function getTemperature (uint256 g) internal pure returns (uint16) { return uint16((g & TEMP_MASK)       >> 80);  }
    function getRadiation   (uint256 g) internal pure returns (uint16) { return uint16((g & RADIATION_MASK)  >> 96);  }
    function getSensory     (uint256 g) internal pure returns (uint16) { return uint16((g & SENSORY_MASK)    >> 112); }
    function getEntropySeed (uint256 g) internal pure returns (uint64) { return uint64((g & ENTROPY_MASK)    >> 128); }
    function getReserved    (uint256 g) internal pure returns (uint64) { return uint64(g >> 192); }

    // ─── Setters (returns new genome — immutable pattern) ─────────────────────

    function setSpeciesId   (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~SPECIES_MASK)        | uint256(v); }
    function setPlanetId    (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~PLANET_MASK)         | (uint256(v) << 16);  }
    function setAtmosphere  (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~ATMOS_MASK)          | (uint256(v) << 32);  }
    function setMetabolism  (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~METABOLISM_MASK)     | (uint256(v) << 48);  }
    function setGravity     (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~GRAVITY_MASK)        | (uint256(v) << 64);  }
    function setTemperature (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~TEMP_MASK)           | (uint256(v) << 80);  }
    function setRadiation   (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~RADIATION_MASK)      | (uint256(v) << 96);  }
    function setSensory     (uint256 g, uint16 v) internal pure returns (uint256) { return (g & ~SENSORY_MASK)        | (uint256(v) << 112); }
    function setEntropySeed (uint256 g, uint64 v) internal pure returns (uint256) { return (g & ~ENTROPY_MASK)        | (uint256(v) << 128); }

    // ─── Mutation (XOR bitwise) ───────────────────────────────────────────────

    /// @notice Applies a mutation to a genome.
    ///         Higher mutationIntensity → more entropy bits flipped.
    ///         Cost in OBAMEOW tokens should be validated by the caller.
    /// @param parentGenome     The parent's genome
    /// @param mutationIntensity Intensity in [1–64], each unit = ~1 bit flip on average
    /// @param randomSeed       Fresh randomness (from VRF)
    /// @return newGenome       Mutated child genome
    function mutate(
        uint256 parentGenome,
        uint8   mutationIntensity,
        bytes32 randomSeed
    ) internal pure returns (uint256 newGenome) {
        require(mutationIntensity > 0 && mutationIntensity <= 64, "genomix: intensity out of range");

        // Build mutation mask: scale random seed by intensity
        // Higher intensity → more bits set in mask
        uint256 mask = uint256(randomSeed);

        // Reduce mask density for lower intensities
        // Intensity 1 → ~1/64 bits set, Intensity 64 → all bits eligible
        uint256 intensityFactor = (uint256(mutationIntensity) * type(uint256).max) / 64;
        mask = mask & intensityFactor;

        // Protect reserved bits from mutation (optional policy)
        mask = mask & ~RESERVED_MASK;

        newGenome = parentGenome ^ mask;
    }

    /// @notice Targeted mutation: only flips bits in the entropy seed region.
    ///         Safer mutation that preserves core species identity.
    function mutateEntropy(
        uint256 parentGenome,
        bytes32 randomSeed
    ) internal pure returns (uint256 newGenome) {
        uint256 mask = (uint256(randomSeed) << 128) & ENTROPY_MASK;
        newGenome = parentGenome ^ mask;
    }

    // ─── Compatibility Scoring ────────────────────────────────────────────────

    /// @notice Computes environmental fitness score [0–10000] for a genome
    ///         against a planet's physics. Used for survival probability.
    /// @return score  0 = certain death, 10000 = perfect adaptation
    function fitnesScore(
        uint256 genome,
        uint16  planetOxygen,
        uint16  planetGravity,
        uint16  planetTemp,
        uint16  planetRadiation
    ) internal pure returns (uint16 score) {
        uint256 total = 0;

        // Atmosphere match (O₂ adaptation vs planet oxygen)
        uint16 atmos = getAtmosphere(genome);
        uint16 atmosExpected = uint16((uint256(planetOxygen) * 655) & 0xFFFF);
        total += 2500 - _delta16(atmos, atmosExpected);

        // Gravity match
        uint16 grav = getGravity(genome);
        uint16 gravExpected = uint16((uint256(planetGravity) * 13) & 0xFFFF);
        total += 2500 - _delta16(grav, gravExpected);

        // Temperature match
        uint16 temp = getTemperature(genome);
        total += 2500 - _delta16(temp, planetTemp);

        // Radiation match
        uint16 rad = getRadiation(genome);
        total += 2500 - _delta16(rad, planetRadiation);

        score = uint16(total > 10000 ? 10000 : total);
    }

    // ─── Off-Chain Expansion Interface ───────────────────────────────────────

    /// @notice Returns all decoded fields as a struct for off-chain use or
    ///         for passing to your simulation/render engine.
    struct DecodedGenome {
        uint16 speciesId;
        uint16 planetId;
        uint16 atmosphere;
        uint16 metabolism;
        uint16 gravity;
        uint16 temperature;
        uint16 radiation;
        uint16 sensory;
        uint64 entropySeed;
        uint64 reserved;
    }

    function decode(uint256 g) internal pure returns (DecodedGenome memory d) {
        d.speciesId    = getSpeciesId(g);
        d.planetId     = getPlanetId(g);
        d.atmosphere   = getAtmosphere(g);
        d.metabolism   = getMetabolism(g);
        d.gravity      = getGravity(g);
        d.temperature  = getTemperature(g);
        d.radiation    = getRadiation(g);
        d.sensory      = getSensory(g);
        d.entropySeed  = getEntropySeed(g);
        d.reserved     = getReserved(g);
    }

    // ─── Lineage ──────────────────────────────────────────────────────────────

    /// @notice Checks if two genomes share the same species lineage root.
    function sameSpecies(uint256 a, uint256 b) internal pure returns (bool) {
        return getSpeciesId(a) == getSpeciesId(b);
    }

    /// @notice Checks if two genomes originated from the same planet.
    function samePlanetOrigin(uint256 a, uint256 b) internal pure returns (bool) {
        return getPlanetId(a) == getPlanetId(b);
    }

    /// @notice Computes Hamming distance (bit difference count) between two genomes.
    ///         Useful for evolutionary distance tracking.
    function hammingDistance(uint256 a, uint256 b) internal pure returns (uint16) {
        return _popcount(a ^ b);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /// @dev Clamped delta between two uint16s, scaled to max 2500 (fitness contribution)
    function _delta16(uint16 a, uint16 b) private pure returns (uint256) {
        uint256 delta = a > b ? uint256(a) - uint256(b) : uint256(b) - uint256(a);
        // Clamp to max contribution
        return delta > 2500 ? 2500 : delta;
    }

    /// @dev Counts set bits (popcount) in a uint256. Used for Hamming distance.
    function _popcount(uint256 x) private pure returns (uint16 count) {
        unchecked {
            while (x != 0) {
                x &= x - 1;
                count++;
            }
        }
    }
}
