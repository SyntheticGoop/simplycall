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

export function encode(data: unknown): { ok: FormData } | { err: unknown } {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: Unknown input
    const parents = new Map<any, [Key: string[], any]>();
    const customMapping: [
      string[],
      (
        | "n"
        | "u"
        | "d"
        | "m"
        | "s"
        | "b"
        | "f"
        | "u8"
        | "i8"
        | "u16"
        | "i16"
        | "u32"
        | "i32"
        | "u64"
        | "i64"
      ),
    ][] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Unknown input
    const externalMapping: any = [];

    const json = JSON.stringify(data, function (key, value) {
      const prefix = parents.get(this)?.[0] ?? [];

      switch (typeof this[key]) {
        // serializable
        case "string":
        case "bigint":
        case "boolean":
          return value;

        // manual handling
        case "number":
          if (!Number.isFinite(value)) {
            customMapping.push([prefix.concat([key]), "n"]);
            return value.toString();
          }
          return value;
        case "undefined":
          customMapping.push([prefix.concat([key]), "u"]);
          return 0;

        case "object":
          parents.set(this[key], [prefix.concat([key]), this]);

          if (this[key] instanceof Date) {
            customMapping.push([prefix.concat([key]), "d"]);
            return this[key].toISOString();
          }
          if (this[key] instanceof Map) {
            customMapping.push([prefix.concat([key]), "m"]);
            return [...this[key]];
          }
          if (this[key] instanceof Set) {
            customMapping.push([prefix.concat([key]), "s"]);
            return [...this[key]];
          }
          if (this[key] instanceof File) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "f"]);
            externalMapping.push(this[key]);
            return index;
          }
          if (this[key] instanceof Blob) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "b"]);
            externalMapping.push(this[key]);
            return index;
          }
          if (this[key] instanceof Uint8Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "u8"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof Int8Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "i8"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof Uint16Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "u16"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof Int16Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "i16"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof Uint32Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "u32"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof Int32Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "i32"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof BigUint64Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "u64"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          if (this[key] instanceof BigInt64Array) {
            const index = customMapping.length;
            customMapping.push([prefix.concat([key]), "i64"]);
            externalMapping.push(new Blob([this[key]]));
            return index;
          }
          return value;
        /// No handling
        case "symbol":
        case "function":
          return value;
      }
    });

    const formData = new FormData();
    formData.set("j", json);
    formData.set("m", JSON.stringify(customMapping));
    for (let i = 0; i < externalMapping.length; i++) {
      formData.set(`${i}`, externalMapping[i]);
    }
    return { ok: formData };
  } catch (err) {
    return { err };
  }
}

/**
 * Decodes {@link FormData} encoded by the corresponding encoder.
 *
 * This function will never throw.
 */
export async function decode(
  data: FormData,
): Promise<{ ok: unknown } | { err: unknown }> {
  try {
    const json = data.get("j")?.toString() ?? "{}";
    const customMapping = JSON.parse(data.get("m")?.toString() ?? "[]");

    const result = { "": JSON.parse(json) };

    for (const [keys, type] of customMapping) {
      const last = keys.pop();

      // biome-ignore lint/suspicious/noExplicitAny: Unknown input
      let entry: any = result;
      for (const key of keys) {
        entry = entry[key];
      }

      if (typeof last === "string") {
        switch (type) {
          case "n":
            entry[last] = Number(entry[last]);
            break;
          case "u":
            entry[last] = undefined;
            break;
          case "d":
            entry[last] = new Date(entry[last]);
            break;
          case "m":
            entry[last] = new Map(entry[last]);
            break;
          case "s":
            entry[last] = new Set(entry[last]);
            break;
          case "b":
            entry[last] = new Blob([data.get(`${entry[last]}`) as File]);
            break;
          case "f":
            entry[last] = data.get(`${entry[last]}`);
            break;
          case "u8":
            entry[last] = new Uint8Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "i8":
            entry[last] = new Int8Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "u16":
            entry[last] = new Uint16Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "i16":
            entry[last] = new Int16Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "u32":
            entry[last] = new Uint32Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "i32":
            entry[last] = new Int32Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "u64":
            entry[last] = new BigUint64Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
          case "i64":
            entry[last] = new BigInt64Array(
              await (data.get(`${entry[last]}`) as File).arrayBuffer(),
            );
            break;
        }
      }
    }

    return { ok: result[""] };
  } catch (err) {
    return { err };
  }
}
