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
            
            get subService() {
              return new SubService("test-id")
            }

            getSubService(id) {
              return new SubService(id)
            }
          }

          class SubService extends RpcTarget {
            #id

            constructor(id) {
              super()
              this.#id = id
            }

            get id() {
              return this.#id
            }

            getId() {
              return this.#id
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
  test("Returning an object over bindings works", async ({ miniflare }) => {
    const bindings = await miniflare.getBindings<{ SERVICE: any }>("worker-a");

    const o = await bindings.SERVICE.objectMethod();
    expect(o).toEqual({ value: 123 });
  });

  test("Returning an RpcTarget from getter works", async ({ miniflare }) => {
    const bindings = await miniflare.getBindings<{ SERVICE: any }>("worker-a");
    const id = await bindings.SERVICE.subService.id;

    expect(id).toBe("test-id");
  });

  test("Returning an RpcTarget from method works", async ({ miniflare }) => {
    const bindings = await miniflare.getBindings<{ SERVICE: any }>("worker-a");
    const id = await bindings.SERVICE.getSubService("my-test-id").id;

    expect(id).toBe("my-test-id");
  });
});
