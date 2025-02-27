// The MIT License (MIT)
//
// Copyright (c) 2025 SyntheticGoop
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

export const ctx = Symbol();

/**
 * A router that binds functions and validators to unique identifiers and
 * provides an interface to call those functions.
 */
export class Router<Context = void> {
  private routes: Record<
    string,
    {
      parser: (...args: unknown[]) => unknown[];
      handler: (
        this: { [ctx]: Context },
        ...args: unknown[]
      ) => Promise<unknown>;
    }
  > = {};

  /**
   * Define the scope to which a route is bound to.
   * This must combine with the route name to be globally unique.
   *
   * The scope name is used to disambiguate what would otherwise be
   * duplicate route functions.
   *
   * You are allowed to reuse scopes in multiple places, just as long
   * as you do not create functions with the same name on the same
   * scope.
   *
   * Examples
   * ```ts
   * .on("authorization routes"); // Named style scope
   * .on("/auth/public");         // Path based routing style scope
   * .on("DSO240DF_lURJNW");      // Random ID based scope
   * ```
   */
  public on<Scope extends string>(/** Function scope */ scope: Scope) {
    const boundThis = this;
    return {
      /**
       * Define the functions bound on this scope.
       *
       * Functions will have their `this` keyword include a binding to
       * the {@link Context} object. The context can be accessed using
       * the {@link ctx} symbol.
       *
       * Despite how it is declared, this object is not shared between
       * functions and across multiple function invocations.
       *
       * It is generally recommended that these functions never throw
       * and instead return errors as values.
       *
       * Documenation on the functions and their arguments will be preserved.
       *
       * Be careful in the selection of function argument types. Depending on
       * the serializer used, not all arguments types will be serializable.
       *
       * The requirement for defining functions as object keys is a side effect
       * of the requirement to accurately reflect function docstrings.
       *
       * Examples
       * ```ts
       * .with({
       *   async route1(arg1: string, arg2: Blob) {
       *     return this[ctx].auth.isAdmin();        // Access context object
       *   },
       *   async route2(arg1: boolean) {             // Declare multiple routes
       *     return null;
       *   },
       * });
       * ```
       */
      with<
        Rpc extends Record<
          string,
          // biome-ignore lint/suspicious/noExplicitAny: Generic inference
          (this: { [ctx]: Context }, ...args: any) => Promise<any>
        >,
      >(
        /** Function handlers */
        handlers: Rpc,
      ) {
        return {
          /**
           * As the router is intended to be mapped onto data without type
           * guarantees, it is required to either define a parser for the
           * function's arguments or explicitly opt out of any type assertion.
           *
           * These parser functions should **always** throw on invalid data.
           * It is expected that functions calls are guaranteed to be typesafe
           * through `typescript` type inference. Therefore parsing failures
           * are expected to not come from regular usage.
           *
           * Try not to define types that are more restrictive than what typescript
           * types can guarantee.
           *
           * Examples
           * ```ts
           * .conformArgumentsThrough({
           *   route1: zod.array([zod.string(), zod.boolean()]).parse, // Use an extrnal validation library like zod
           *   route2(...args: unknown) {                              // Define your own parser
           *     this[ctx].failOnUnauth()                              // If defined as an object function, the context can be accessed.
           *     if (typeof args[0] !== "string") throw Error();
           *     if (typeof args[1] !== "number") throw Error();
           *     return [args[0], args[1]] as [string, number];
           *   }
           * });
           * ```
           */
          conformArgumentsThrough<
            Parsers extends {
              [Key in keyof Rpc]:
              | ((
                this: { [ctx]: Context },
                ...data: unknown[]
              ) => Rpc[Key] extends (
                ...args: infer Args
                // biome-ignore lint/suspicious/noExplicitAny: Generic inference
              ) => any
                ? Args
                : never)
              | "assume typesafe";
            },
          >(parsers: Parsers) {
            for (const name of Object.keys(parsers)) {
              const id = `${scope} ${name}`;
              if (id in boundThis.routes)
                throw Error(
                  `Route [${id}] was declared twice and is not unique.`,
                );

              const parser =
                parsers[name] === "assume typesafe"
                  ? (...args: unknown[]) => args
                  : parsers[name];
              const handler = handlers[name];

              boundThis.routes[id] = {
                parser,
                handler,
              };
            }

            return {
              scope,
              parsers,
              handlers,
              with(context: Context) {
                return { [ctx]: context, ...handlers };
              },
            };
          },
        };
      },
    };
  }

  /**
   * Route requests through the router, returning a result
   * object containing the state of execution.
   *
   * This function will never throw.
   */
  public async routeFromTransportInfallibly(rpc: {
    /**
     * The context object to provide a route handler.
     */
    ctx: Context;
    /**
     * The unique `identity` of the route.
     */
    id: string;
    /**
     * The arguments to be call the routed function with.
     */
    args: unknown[];
  }) {
    const route = this.routes[rpc.id];
    if (!route)
      return {
        err: {
          "non existent route": `Route [${rpc.id}] does not exist!`,
        },
      };

    let args: unknown[];
    try {
      args = route.parser(...rpc.args);
    } catch (error) {
      return {
        err: {
          "argument parsing failed": error,
        },
      };
    }

    const result = await route.handler
      .call({ [ctx]: rpc.ctx }, ...args)
      .then((ok) => ({ ok }))
      .catch((err) => ({ err }));
    if ("err" in result)
      return {
        err: {
          "handler errored": result.err,
        },
      };

    return result;
  }
}

/**
 * A client library that, from the inference of a router route,
 * generates a corresponding object that allows for interfacing
 * with that route.
 */
export class Client<Context = undefined> {
  /**
   * Create a new client.
   *
   * It is necessary to define a shared function that will
   * be used to make remote calls to the router.
   */
  constructor(
    /**
     * Object that maps over a remote procedure call.
     */
    private readonly transport: {
      /**
       * Remote call function.
       *
       * This function must always return the expected response or error.
       * This property of throwing error on unexpected response is a
       * side effect of accurate reflection of function docstrings.
       *
       * @returns `unknown` The response from calling the remote function.
       */
      sendThroughTransportFallibly(rpc: {
        /**
         * The context object injected as part of each call.
         */
        ctx: Context;
        /**
         * The unique `identity` of the route.
         */
        id: string;
        /**
         * The arguments to be call the routed function with.
         */
        args: unknown[];
      }): unknown;
    },
  ) { }

  /**
   * Call a typed remote route with the bound client.
   *
   * Using the remote route's type as a generic, we can
   * generate the correct corresponding types and arguments
   * for the server to properly route requests.
   *
   * Examples
   * ```ts
   * const route = server.on(...).with(..).conformArgumentsThrough(...);               // Route definition. See {@link Router}
   * const result = client.on<typeof route>("scope").remoteFunctionName(...args);      // Call the route
   * const result = client.on<typeof route>("scope", ctx).remoteFunctionName(...args)  // Call the route with context. Required if context is defined.
   * ```
   */
  public on<MaybeRPC>(
    scope: MaybeRPC extends { scope: infer Scope } ? Scope : never,
    ...options: Context extends undefined ? [ctx?: Context] : [ctx: Context]
  ): MaybeRPC extends { handlers: infer Rpc } ? Rpc & { [ctx]: never } : never {
    const transport = this.transport;
    return new Proxy(
      {},
      {
        get(_, prop) {
          /* v8 ignore next 1 */
          if (typeof prop !== "string") return;
          return (...args: unknown[]) =>
            transport.sendThroughTransportFallibly({
              id: `${scope} ${prop}`,
              args,
              // @ts-expect-error Typescript does not understand that when context extends undefined, Context === Context | undefined
              ctx: options[0],
            });
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: Construction of "any" object
    ) as any;
  }
}
