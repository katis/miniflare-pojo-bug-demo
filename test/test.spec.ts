import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Miniflare } from "miniflare";

const test = it.extend<{ miniflare: Miniflare }>({
  miniflare: async ({}, use) => {
    const mf = new Miniflare({
      workers: [
        {
          name: "worker-a",
          serviceBindings: {
            SERVICE: { name: "service-a", entrypoint: "Entrypoint" },
          },
          compatibilityFlags: ["rpc"],
          modules: true,
          script: `
          export default {
            async fetch(req, env) {
              try {
                const foo = await env.SERVICE.getService("service-1").nullMethod();
                return new Response("ok")
              } catch (error) {
               return new Response(JSON.stringify({error: error.message, stack: error.stack}), { status: 500 });
              }
            }
          }
        `,
        },
        {
          name: "service-a",
          compatibilityFlags: ["rpc"],
          modules: true,
          script: `
          import { WorkerEntrypoint, RpcTarget } from "cloudflare:workers";

          export class Entrypoint extends WorkerEntrypoint {
            objectMethod() {
              return { value: 123 }
            }
          }
        `,
        },
      ],
    });
    try {
      await use(mf);
    } finally {
      await mf.dispose();
    }
  },
});

describe("miniflare issues", () => {
  test("Cannot stringify POJOs with symbolic keys", async ({ miniflare }) => {
    const bindings = await miniflare.getBindings<{ SERVICE: any }>("worker-a");

    const o = await bindings.SERVICE.objectMethod();
    expect(o).toEqual({ value: 123 });
  });
});
