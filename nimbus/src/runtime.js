import { createAnticipation } from "./anticipation.js";
import { createColony } from "./colony.js";
import { createContinuum } from "./continuum.js";
import { createDebate } from "./debate.js";
import { createMemory } from "./memory.js";
import { createParkDesk } from "./park.js";
import { createPresence } from "./presence.js";
import { createSkillForge } from "./skills.js";
import { createStackTwin } from "./stack-twin.js";
import { createTrust } from "./trust.js";
import { createVoiceSession } from "./voice.js";

export function createNimbus(rootDir, options = {}) {
  const memory = createMemory(rootDir, options);
  const trust = createTrust(rootDir, options.trust);
  const twin = createStackTwin(rootDir);
  const colony = createColony(rootDir, {
    permissionMode: options.permissionMode ?? "deny",
    now: options.now,
    trust,
    twin,
  });
  return {
    memory,
    trust,
    twin,
    colony,
    anticipation: createAnticipation(rootDir, options),
    presence: createPresence(rootDir),
    skills: createSkillForge(rootDir, options),
    debate: createDebate(rootDir, options),
    continuum: createContinuum(rootDir, options),
    park: createParkDesk(rootDir, options),
    voice: createVoiceSession(options.voice),
  };
}
