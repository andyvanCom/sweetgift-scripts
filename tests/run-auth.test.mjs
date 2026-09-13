import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  authorizeRunRequest,
  forwardRunAuthHeaders,
} from "../supabase/functions/_shared/run-auth.ts";

const newSecret = "test-new-secret";
const legacySecret = "test-legacy-secret";
const config = {
  newSecret,
  legacySecret,
  legacyHeaders: ["x-report-secret"],
};

test("missing secret is rejected", async () => {
  assert.equal(await authorizeRunRequest(new Request("https://test"), config), false);
});

test("wrong secret is rejected", async () => {
  const request = new Request("https://test", {
    headers: { "x-sweetgift-run-secret": "wrong" },
  });
  assert.equal(await authorizeRunRequest(request, config), false);
});

test("legacy secret is temporarily accepted", async () => {
  const request = new Request("https://test", {
    headers: { "x-report-secret": legacySecret },
  });
  assert.equal(await authorizeRunRequest(request, config), true);
});

test("new function-specific secret is accepted", async () => {
  const request = new Request("https://test", {
    headers: { "x-sweetgift-run-secret": newSecret },
  });
  assert.equal(await authorizeRunRequest(request, config), true);
});

test("legacy bearer and apikey contracts can be validated", async () => {
  const bearer = new Request("https://test", {
    headers: { authorization: `Bearer ${legacySecret}` },
  });
  const apikey = new Request("https://test", {
    headers: { apikey: legacySecret },
  });
  const productConfig = {
    newSecret,
    legacySecret,
    legacyHeaders: ["authorization", "apikey"],
  };

  assert.equal(await authorizeRunRequest(bearer, productConfig), true);
  assert.equal(await authorizeRunRequest(apikey, productConfig), true);
});

test("recursive calls forward only supported run-auth headers", () => {
  const request = new Request("https://test", {
    headers: {
      "x-sweetgift-run-secret": newSecret,
      "x-report-secret": legacySecret,
      authorization: "must-not-forward",
    },
  });
  const forwarded = forwardRunAuthHeaders(request);

  assert.equal(forwarded.get("x-sweetgift-run-secret"), newSecret);
  assert.equal(forwarded.get("x-report-secret"), legacySecret);
  assert.equal(forwarded.has("authorization"), false);
});

for (const functionName of [
  "import-yml-products",
  "import-articles-index",
  "classify-articles",
  "send-daily-report",
]) {
  test(`${functionName} authenticates before creating a service-role client`, async () => {
    const source = await readFile(
      new URL(
        `../supabase/functions/${functionName}/index.ts`,
        import.meta.url,
      ),
      "utf8",
    );
    const handlerStart = Math.max(
      source.indexOf("Deno.serve(async"),
      source.indexOf("serve(async"),
    );
    const handler = source.slice(handlerStart);
    const auth = handler.indexOf("authorizeRunRequest");
    const client = handler.indexOf("createClient(");

    assert.notEqual(handlerStart, -1);
    assert.notEqual(auth, -1);
    assert.notEqual(client, -1);
    assert.ok(auth < client);
  });
}
