import { describe, test, expect, vi } from "vitest";
import { Client, Router, ctx } from "./index";

describe("rpc construction", () => {
  test("allows single function on single scope", async () => {
    const router = new Router();
    const route = router
      .on("scope")
      .with({
        async route1(arg: string) {
          return arg.length;
        },
      })
      .conformArgumentsThrough({
        route1: (...args) => args as [string],
      });

    expect(route).toMatchInlineSnapshot(`
      {
        "handlers": {
          "route1": [Function],
        },
        "parsers": {
          "route1": [Function],
        },
        "scope": "scope",
        "with": [Function],
      }
    `);
    await expect(route.with().route1("1234")).resolves.toMatchInlineSnapshot(
      `4`,
    );
  });

  test("allows multiple functions on single scope", async () => {
    const router = new Router();
    const route = router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
        async route2() {
          return "route2";
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
        route2: "assume typesafe",
      });

    expect(route).toMatchInlineSnapshot(`
      {
        "handlers": {
          "route1": [Function],
          "route2": [Function],
        },
        "parsers": {
          "route1": "assume typesafe",
          "route2": "assume typesafe",
        },
        "scope": "scope",
        "with": [Function],
      }
    `);
    await expect(route.with().route1()).resolves.toMatchInlineSnapshot(
      `"route1"`,
    );
    await expect(route.with().route2()).resolves.toMatchInlineSnapshot(
      `"route2"`,
    );
  });

  test("allows scope reuse when function is different", async () => {
    const router = new Router();
    const route1 = router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({ route1: "assume typesafe" });
    const route2 = router
      .on("scope")
      .with({
        async route2() {
          return "route2";
        },
      })
      .conformArgumentsThrough({ route2: "assume typesafe" });

    expect(route1).toMatchInlineSnapshot(`
      {
        "handlers": {
          "route1": [Function],
        },
        "parsers": {
          "route1": "assume typesafe",
        },
        "scope": "scope",
        "with": [Function],
      }
    `);
    expect(route2).toMatchInlineSnapshot(`
      {
        "handlers": {
          "route2": [Function],
        },
        "parsers": {
          "route2": "assume typesafe",
        },
        "scope": "scope",
        "with": [Function],
      }
    `);
    await expect(route1.with().route1()).resolves.toMatchInlineSnapshot(
      `"route1"`,
    );
    await expect(route2.with().route2()).resolves.toMatchInlineSnapshot(
      `"route2"`,
    );
  });

  test("allows function reuse when scope is different", async () => {
    const router = new Router();
    const scope1 = router
      .on("scope 1")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({ route1: "assume typesafe" });
    const scope2 = router
      .on("scope 2")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({ route1: "assume typesafe" });

    expect(scope1).toMatchInlineSnapshot(`
      {
        "handlers": {
          "route1": [Function],
        },
        "parsers": {
          "route1": "assume typesafe",
        },
        "scope": "scope 1",
        "with": [Function],
      }
    `);
    expect(scope2).toMatchInlineSnapshot(`
      {
        "handlers": {
          "route1": [Function],
        },
        "parsers": {
          "route1": "assume typesafe",
        },
        "scope": "scope 2",
        "with": [Function],
      }
    `);
    await expect(scope1.with().route1()).resolves.toMatchInlineSnapshot(
      `"route1"`,
    );
    await expect(scope2.with().route1()).resolves.toMatchInlineSnapshot(
      `"route1"`,
    );
  });

  test("crashes on declaration if identifier collides", () => {
    const router = new Router();
    router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({ route1: "assume typesafe" });
    expect(() =>
      router
        .on("scope")
        .with({
          async route1() {
            return "route1";
          },
        })
        .conformArgumentsThrough({ route1: "assume typesafe" }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Route [scope route1] was declared twice and is not unique.]`,
    );
  });
});

describe("route binding", () => {
  test("correct routing of rpc", async () => {
    const router = new Router();
    const routes = router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
        async route2() {
          return "route2";
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
        route2: "assume typesafe",
      });

    await expect(
      router.routeFromTransport({ ctx: void 0, id: "scope route1", args: [] }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "ok": "route1",
      }
    `);
    await expect(
      router.routeFromTransport({ ctx: void 0, id: "scope route2", args: [] }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "ok": "route2",
      }
    `);
  });

  test("correct handling of non-existent definition", async () => {
    const router = new Router();
    router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({ route1: "assume typesafe" });
    await expect(
      router.routeFromTransport({
        ctx: void 0,
        args: [],
        id: "scope route2",
      }),
    ).resolves.toMatchInlineSnapshot(`
        {
          "err": {
            "non existent route": "Route [scope route2] does not exist!",
          },
        }
      `);
  });

  test("allows successful parse", async () => {
    const router = new Router();
    router
      .on("scope")
      .with({
        async route1(arg1: string, arg2: boolean) {
          return "route1";
        },
      })
      .conformArgumentsThrough({
        route1(arg1, arg2) {
          if (typeof arg1 !== "string") throw Error("failed");
          if (typeof arg2 !== "boolean") throw Error("failed");
          return [arg1, arg2];
        },
      });

    await expect(
      router.routeFromTransport({
        ctx: void 0,
        args: ["", false],
        id: "scope route1",
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "ok": "route1",
      }
    `);
  });

  test("rejects on parse error", async () => {
    const router = new Router();
    router
      .on("scope")
      .with({
        async route1(arg: string) {
          return "route1";
        },
      })
      .conformArgumentsThrough({
        route1(arg) {
          throw Error("always fail");
        },
      });

    await expect(
      router.routeFromTransport({
        ctx: void 0,
        args: [],
        id: "scope route1",
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "err": {
          "argument parsing failed": [Error: always fail],
        },
      }
    `);
  });

  test("rejects on unexpected route error", async () => {
    const router = new Router();
    router
      .on("scope")
      .with({
        async route1(arg: string) {
          throw Error("always fail");
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
      });

    await expect(
      router.routeFromTransport({
        ctx: void 0,
        args: [],
        id: "scope route1",
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "err": {
          "handler errored": [Error: always fail],
        },
      }
    `);
  });

  test("passes context into function", async () => {
    const router = new Router<{ log: (arg: string) => void }>();
    router
      .on("scope")
      .with({
        async route1(arg: string) {
          this[ctx].log("log");
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
      });

    const context = { log: vi.fn() };

    await router.routeFromTransport({
      ctx: context,
      args: [],
      id: "scope route1",
    });
    expect(context.log).toBeCalledWith("log");
  });

  test("passes context into validator", async () => {
    const router = new Router<{ log: (arg: string) => void }>();
    router
      .on("scope")
      .with({
        async route1(arg: string) {
          this[ctx].log("log");
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
      });

    const context = { log: vi.fn() };

    await router.routeFromTransport({
      ctx: context,
      args: [],
      id: "scope route1",
    });
    expect(context.log).toBeCalledWith("log");
  });
});

describe("client typegen", () => {
  test("constructs correct identity and arguments", async () => {
    const router = new Router<{}>();
    const route = router
      .on("scope")
      .with({
        /** a route */
        async route1(
          /** a string */
          arg1: string,
          /** a number */
          arg2: number,
          /** a boolean */
          arg3: boolean,
          /** anything */
          ...argx: any[]
        ) {
          return {
            arg1,
            arg2,
            arg3,
            argx,
          };
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
      });

    const client = new Client({
      async sendThroughTransport(rpc) {
        return await router
          .routeFromTransport({
            ctx: {},
            id: rpc.id,
            args: rpc.args,
          })
          .then((result) => {
            if ("err" in result) throw result.err;
            return result.ok;
          });
      },
    });

    await expect(
      client.on<typeof route>("scope").route1("a", 0, true, null, null, ""),
    ).resolves.toMatchInlineSnapshot(`
      {
        "arg1": "a",
        "arg2": 0,
        "arg3": true,
        "argx": [
          null,
          null,
          "",
        ],
      }
    `);
  });

  test("requires context if enforced", async () => {
    const router = new Router();
    const route = router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
      });

    const client = new Client<{}>({
      async sendThroughTransport(rpc) {
        expect(rpc.ctx).toMatchInlineSnapshot(`{}`);
        return await router
          .routeFromTransport({
            ctx: void 0,
            id: rpc.id,
            args: rpc.args,
          })
          .then((result) => {
            if ("err" in result) throw result.err;
            return result.ok;
          });
      },
    });

    await expect(
      client.on<typeof route>("scope", {}).route1(),
    ).resolves.toMatchInlineSnapshot(`"route1"`);
    expect.assertions(2);
  });

  test("skips context if optional", async () => {
    const router = new Router();
    const route = router
      .on("scope")
      .with({
        async route1() {
          return "route1";
        },
      })
      .conformArgumentsThrough({
        route1: "assume typesafe",
      });

    const contexts: any[] = [];
    const client = new Client<{} | undefined>({
      async sendThroughTransport(rpc) {
        contexts.push(rpc.ctx);
        return await router
          .routeFromTransport({
            ctx: void 0,
            id: rpc.id,
            args: rpc.args,
          })
          .then((result) => {
            if ("err" in result) throw result.err;
            return result.ok;
          });
      },
    });

    await expect(
      client.on<typeof route>("scope", {}).route1(),
    ).resolves.toMatchInlineSnapshot(`"route1"`);
    await expect(
      client.on<typeof route>("scope").route1(),
    ).resolves.toMatchInlineSnapshot(`"route1"`);
    expect(contexts).toMatchInlineSnapshot(`
      [
        {},
        undefined,
      ]
    `);
  });
});
