import { createServer } from "node:http";
import { scanWithZaber } from "./zaber-stage.mjs";

const cloudId = process.env.ZABER_CLOUD_ID;
if (!cloudId) {
    throw new Error("Set ZABER_CLOUD_ID before starting the server.");
}

let running = false;

function sendJson(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/api/scan") {
        return sendJson(response, 404, { error: "Route not found." });
    }

    let angles;
    try {
        let body = "";
        for await (const chunk of request) body += chunk;
        angles = JSON.parse(body).angles;
    } catch {
        return sendJson(response, 400, { error: "Expected a JSON scan plan." });
    }

    if (
        !Array.isArray(angles) ||
        angles.length === 0 ||
        angles.some((angle) => !Number.isFinite(angle) || angle < 0 || angle > 90)
    ) {
        return sendJson(response, 400, { error: "Enter angles from 0° to 90°." });
    }

    if (running) {
        return sendJson(response, 409, { error: "A scan is already running." });
    }

    running = true;
    response.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
    });
    response.flushHeaders();

    function sendUpdate(update) {
        response.write(`${JSON.stringify(update)}\n`);
    }

    try {
        await scanWithZaber(cloudId, angles, sendUpdate);
        sendUpdate({ status: "complete" });
    } catch (error) {
        sendUpdate({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
        });
    } finally {
        running = false;
        response.end();
    }
}).listen(3001, "127.0.0.1", () => {
    console.log("Scan server listening on http://127.0.0.1:3001");
});