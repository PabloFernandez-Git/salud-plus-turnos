import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const form = (path) => `<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TASK-013 · credencial DEV</title>
<style>body{font:16px system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:1rem;color:#0f172a}label{display:block;margin:1.5rem 0 .5rem}input,button{box-sizing:border-box;width:100%;min-height:3rem;padding:.7rem;font:inherit}button{margin-top:1rem;background:#0369a1;color:white;border:0;border-radius:.4rem}p{line-height:1.5}</style>
<h1>Validación TASK-013 en DEV</h1>
<p>Ingresá la contraseña PostgreSQL DEV preexistente. Se entrega sólo al proceso local de esta corrida; no se guarda en disco ni se envía por chat.</p>
<form method="post" action="${path}" autocomplete="off"><label for="password">Contraseña PostgreSQL DEV</label><input id="password" name="password" type="password" required autocomplete="off" autofocus><button type="submit">Iniciar validación única</button></form></html>`;

function send(response, code, body, extraHeaders = {}) {
  response.writeHead(code, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...extraHeaders,
  });
  response.end(body);
}

export async function serveOneCredential({ onPassword, timeoutMs = 600_000 } = {}) {
  if (typeof onPassword !== "function") throw new Error("Credential consumer is required");
  const token = randomBytes(32).toString("hex");
  const path = `/task013/${token}`;
  let submitted = false;
  let finish;
  const completed = new Promise((resolveCompleted) => {
    finish = resolveCompleted;
  });
  const server = createServer(async (request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.headers.host !== `127.0.0.1:${server.address().port}` || request.url !== path) {
      send(response, 404, "Not found");
      return;
    }
    if (request.method === "GET") {
      if (submitted)
        send(response, 409, "Esta credencial ya fue recibida. Seguí el estado en el chat.");
      else send(response, 200, form(path));
      return;
    }
    if (
      request.method !== "POST" ||
      request.headers.origin !== origin ||
      !/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers["content-type"] ?? "") ||
      submitted
    ) {
      send(response, 403, "Solicitud rechazada");
      return;
    }
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString("utf8");
      if (body.length > 1024) {
        send(response, 413, "Solicitud demasiado grande");
        return;
      }
    }
    const password = new URLSearchParams(body).get("password");
    if (!password || password.length > 512) {
      send(response, 400, "Contraseña inválida");
      return;
    }
    submitted = true;
    send(
      response,
      202,
      "<!doctype html><html lang=es><meta charset=utf-8><title>TASK-013 iniciada</title><p>Credencial recibida. La validación única está en curso; seguí el resultado en el chat.</p></html>",
    );
    try {
      finish(await onPassword(password));
    } catch (error) {
      finish(error);
    }
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolveListening, reject) => {
    server.once("listening", resolveListening);
    server.once("error", reject);
  });
  const url = `http://127.0.0.1:${server.address().port}${path}`;
  const timer = setTimeout(
    () => finish(new Error("Credential form timed out before DEV writes")),
    timeoutMs,
  );
  return {
    url,
    async wait() {
      const result = await completed;
      clearTimeout(timer);
      await new Promise((resolveClosed) => server.close(resolveClosed));
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

async function run() {
  const mode = process.argv[2];
  if (!["--execute", "--recover"].includes(mode) || process.argv.length !== 3)
    throw new Error("Use exactly --execute or --recover");
  if (process.env.TASK013_DEV_WRITE_AUTHORIZATION !== "TASK-013-VISUAL-DEV-APPROVED")
    throw new Error("Explicit TASK-013 DEV write authorization is missing; STOP");
  const bridge = await serveOneCredential({
    onPassword(password) {
      return new Promise((resolveChild, rejectChild) => {
        const child = spawn(
          process.execPath,
          [resolve("scripts/task013-agenda-visual/run.mjs"), mode],
          {
            cwd: resolve("."),
            env: { ...process.env, SUPABASE_DB_PASSWORD: password },
            stdio: "inherit",
            windowsHide: true,
          },
        );
        child.on("error", rejectChild);
        child.on("exit", (code) =>
          code === 0 ? resolveChild(0) : rejectChild(new Error(`TASK-013 runner exited ${code}`)),
        );
      });
    },
  });
  console.log(`TASK013_CREDENTIAL_URL=${bridge.url}`);
  await bridge.wait();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await run();
