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

/**
 * Create a transport that receives data from
 * a http {@link fetch} {@link Request}.
 *
 * This implementation constrains each argument
 * to one of the following types for serialization:
 * 1. {@link JSON} serializable object
 * 2. {@link Blob} object
 */
export function makeTransportFromFetch<Context>(handler: {
  routeFromTransportInfallibly(rpc: {
    ctx: Context;
    id: string;
    args: unknown[];
  }): Promise<{ err: Record<string, string> } | { ok: unknown }>;
}) {
  return {
    /**
     * Processes a request through the route handler and returns
     * a result type containing either errors or the headers and
     * response body to be used for response construction.
     */
    async onRequestInfallibly(request: Request, ctx: Context) {
      const id = request.headers.get("x-simplycall-id");
      const argtype = request.headers.get("x-simplycall-argtype");

      if (typeof id !== "string")
        return {
          err: {
            "id not provided": "",
          },
        };

      if (typeof argtype !== "string")
        return {
          err: {
            "function arguments are untyped": "",
          },
        };

      const maybeFormData = await request
        .formData()
        .then((ok) => ({ ok }))
        .catch((err) => ({ err }));
      if ("err" in maybeFormData) return maybeFormData;

      const args: unknown[] = [];
      for (const [type, i] of argtype.split("").map((type, i) => [type, i])) {
        if (type !== "b" && type !== "j")
          return {
            err: {
              "unknown argument type": `Route [${id}] called with unknown argument type of [${argtype}].`,
            },
          };
        const data = maybeFormData.ok.get(`${i}`);
        if (!data)
          return {
            err: {
              "missing argument": `Route [${id}] is missing [${type}] type argument at position [${i}].`,
            },
          };
        if (type === "b") {
          args.push(data);
        } else if (type === "j") {
          args.push(JSON.parse(data.toString()));
        }
      }

      const response = await handler.routeFromTransportInfallibly({
        args,
        ctx,
        id,
      });

      if ("err" in response) return response;

      const body = new FormData();
      body.set(
        "0",
        response.ok instanceof Blob ? response.ok : JSON.stringify(response.ok),
      );

      const headers = new Headers();
      headers.append(
        "x-simplycall-argtype",
        response.ok instanceof Blob ? "b" : "j",
      );
      headers.append("Content-Type", "multipart/form-data");

      return {
        ok: {
          body,
          headers,
        },
      };
    },
  };
}
