import { createJsonStore, storePath } from "./store.js";
import { classifyAction } from "./permissions.js";

const EMPTY = { version: 1, nodes: [], edges: [] };
const KINDS = new Set(["service", "repo", "node"]);

/**
 * Local editable graph of the operator stack (services, repos, homelab nodes).
 * Dry-run only — never mutates the real stack.
 */
export function createStackTwin(rootDir) {
  const store = createJsonStore(storePath(rootDir, "stack-twin.json"), EMPTY);

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  return {
    upsertNode(input) {
      const id = normalizeId(input?.id);
      const kind = KINDS.has(input?.kind) ? input.kind : "service";
      if (!id) {
        return { ok: false, code: "invalid_node", message: "id required" };
      }
      return persist((doc) => {
        const existing = doc.nodes.find((node) => node.id === id);
        const node = {
          id,
          kind,
          label: input?.label ?? existing?.label ?? id,
          tags: Array.isArray(input?.tags) ? input.tags.map(String) : (existing?.tags ?? []),
          critical: input?.critical ?? existing?.critical ?? kind === "service",
        };
        if (existing) {
          Object.assign(existing, node);
        } else {
          doc.nodes.push(node);
        }
        const deps = Array.isArray(input?.deps) ? input.deps : [];
        for (const dep of deps) {
          const to = normalizeId(dep);
          if (!to || doc.edges.some((edge) => edge.from === id && edge.to === to)) {
            continue;
          }
          doc.edges.push({ from: id, to, relation: "depends_on" });
        }
        return { ok: true, node };
      });
    },

    link(from, to, relation = "depends_on") {
      const a = normalizeId(from);
      const b = normalizeId(to);
      if (!a || !b) {
        return { ok: false, code: "invalid_edge", message: "from and to required" };
      }
      return persist((doc) => {
        if (!doc.edges.some((edge) => edge.from === a && edge.to === b && edge.relation === relation)) {
          doc.edges.push({ from: a, to: b, relation });
        }
        return { ok: true, edge: { from: a, to: b, relation } };
      });
    },

    graph() {
      const doc = store.read();
      return { ok: true, nodes: doc.nodes.map((item) => ({ ...item })), edges: doc.edges.map((item) => ({ ...item })) };
    },

    simulateImpact(input) {
      const action = input?.action ?? "exec";
      const targetId = normalizeId(input?.targetId);
      const doc = store.read();
      const target = doc.nodes.find((node) => node.id === targetId);
      if (!target) {
        return {
          ok: true,
          dryRun: true,
          targetId,
          action,
          affected: [],
          risk: classifyAction(action).risk,
          blocked: false,
          summary: targetId ? `Nœud inconnu (${targetId}) — impact non simulé.` : "Pas de cible — rien à simuler.",
        };
      }
      const dependents = collectDependents(doc, targetId);
      const classification = classifyAction(action);
      const criticalHit = target.critical || dependents.some((node) => node.critical);
      const highAction = classification.risk === "high";
      const blocked = highAction && criticalHit;
      return {
        ok: true,
        dryRun: true,
        targetId,
        action,
        affected: dependents,
        risk: blocked ? "high" : classification.risk,
        blocked,
        summary: blocked
          ? `Impact sec : ${target.label} est critique (${dependents.length} dépendants). Approbation humaine obligatoire.`
          : `Simulation : ${target.label} + ${dependents.length} dépendant(s).`,
      };
    },
  };
}

function collectDependents(doc, targetId) {
  const found = new Map();
  const walk = (id) => {
    for (const edge of doc.edges) {
      if (edge.to === id && !found.has(edge.from)) {
        const node = doc.nodes.find((item) => item.id === edge.from);
        if (node) {
          found.set(node.id, { ...node });
          walk(node.id);
        }
      }
    }
  };
  walk(targetId);
  return [...found.values()];
}

function normalizeId(id) {
  if (typeof id !== "string") {
    return "";
  }
  return id.trim().toLowerCase().replace(/\s+/g, "-");
}
