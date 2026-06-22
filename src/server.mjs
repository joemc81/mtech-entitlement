import { createServer } from "node:http";
import { validateThemeCode } from "./entitlement-adapter.mjs";

const port = Number.parseInt(process.env.PORT || "8787", 10);

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { ok: true });
    }
    if (request.method !== "POST" || request.url !== "/theme-entitlements") {
      return sendJson(response, 404, { error: "not_found" });
    }
    const body = await readJsonBody(request);
    const result = await validateThemeCode(body);
    return sendJson(response, 200, result);
  } catch {
    return sendJson(response, 200, {
      valid: false,
      entitlements: [],
      message: "Theme validation service unavailable."
    });
  }
});

server.listen(port, () => {
  console.info(JSON.stringify({ event: "entitlement_adapter_started", port }));
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) {
      throw new Error("request_too_large");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
