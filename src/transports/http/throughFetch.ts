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
 * Creates a transport that sends data over
 * http {@link fetch}.
 *
 * This implementation constrains each argument
 * to one of the following types for serialization:
 * 1. {@link JSON} serializable object
 * 2. {@link Blob} object
 */
export function makeTransportThroughFetch(config: {
  url: URL;
}) {
  return {
    async sendThroughTransportFallibly(rpc: {
      ctx: unknown;
      id: string;
      args: unknown[];
    }) {
      const body = new FormData();
      const argtype: Array<"b" | "j"> = [];
      for (const [arg, i] of rpc.args.map((arg, i) => [arg, i])) {
        body.set(`${i}`, arg instanceof Blob ? arg : JSON.stringify(arg));

        argtype.push(arg instanceof Blob ? "b" : "j");
      }

      await fetch(config.url, {
        headers: {
          "x-simplycall-id": rpc.id,
          "x-simplycall-argtype": argtype.join(""),
          "Content-Type": "multipart/form-data",
        },
        method: "POST",
        body,
      }).then(async (result) => {
        const argtype = result.headers.get("x-simplycall-argtype");
        if (argtype !== "b" && argtype !== "j")
          throw Error(
            `Unable to parse response type [${argtype}] for [${rpc.id}].`,
          );

        const formData = await result.formData(); // Allow errors to propagate

        const response = formData.get("0");
        if (!response) throw Error(`No response received for [${rpc.id}].`);

        return argtype === "b" ? response : JSON.parse(response.toString());
      });
    },
  };
}
