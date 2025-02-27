import { describe, test, expect } from "vitest";
import { decode, encode } from "./formData";

describe("codec is reversible", () => {
  test.each([[true], [false], [null], [undefined], ["string"], [1], [1 / -0]])(
    "primitive %o",
    async (data) => {
      // @ts-expect-error
      await expect(decode(encode(data).ok)).resolves.toEqual({ ok: data });
    },
  );

  test.each([
    [{ data: true }],
    [{ data: { data: true } }],
    [{ data: Number.NaN }],
    [{ data: Number.NEGATIVE_INFINITY }],
  ])("recursive %o", async (data) => {
    // @ts-expect-error
    await expect(decode(encode(data).ok)).resolves.toEqual({ ok: data });
  });

  test.each([
    [new Date()],
    [new Map([["key", "value"]])],
    [new Set(["key", "s"])],
    [new Blob([new Uint8Array([1, 2, 3])])],
    [new File([new Blob([new Uint8Array([1, 2, 3])])], "name")],
    [new Uint8Array([1, 2, 3])],
    [new Int8Array([1, 2, 3])],
    [new Uint16Array([1, 2, 3])],
    [new Int16Array([1, 2, 3])],
    [new Uint32Array([1, 2, 3])],
    [new Int32Array([1, 2, 3])],
    [new BigUint64Array([1n, 2n, 3n])],
    [new BigInt64Array([-0xffffffffn, 2n, 3n])],
  ])("custom object %o", async (data) => {
    // @ts-expect-error
    await expect(decode(encode(data).ok)).resolves.toEqual({ ok: data });
    // @ts-expect-error
    await expect(decode(encode({ deep: { data } }).ok)).resolves.toEqual({
      ok: {
        deep: { data },
      },
    });
  });
});
