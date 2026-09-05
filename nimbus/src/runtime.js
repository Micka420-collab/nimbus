import { createColony } from "./colony.js";
import { createContinuum } from "./continuum.js";
import { createMemory } from "./memory.js";
import { createParkDesk } from "./park.js";
import { createTrust } from "./trust.js";

export function createNimbus(rootDir, options = {}) {
  const memory = createMemory(rootDir, options);
  const trust = createTrust(rootDir, options.trust);
  const colony = createColony(rootDir, {
    permissionMode: options.permissionMode ?? "deny",
    now: options.now,
    trust,
  });
  return {
    memory,
    trust,
    colony,
    continuum: createContinuum(rootDir, options),
    park: createParkDesk(rootDir, options),
  };
}
