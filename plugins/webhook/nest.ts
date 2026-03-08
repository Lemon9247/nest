/**
 * Webhook handler plugin for nest.
 *
 * POST /api/webhook with { message, source?, session? }
 * Response goes to all listeners attached to the target session.
 */
import type { NestAPI } from "nest";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateLimits = new Map<string, number[]>();

function isRateLimited(bucket: string): boolean {
    const now = Date.now();
    const ts = rateLimits.get(bucket) ?? [];
    const recent = ts.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
        rateLimits.set(bucket, recent);
        return true;
    }
    recent.push(now);
    rateLimits.set(bucket, recent);
    return false;
}

export default function (nest: NestAPI): void {
    nest.registerRoute("POST", "/api/webhook", async (req, res) => {
        let data = "";
        for await (const chunk of req) {
            data += chunk;
            if (data.length > 1_048_576) {
                res.writeHead(413, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Payload Too Large" }));
                return;
            }
        }

        let body: any;
        try {
            body = JSON.parse(data);
        } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
        }

        if (!body?.message || typeof body.message !== "string") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing field: message" }));
            return;
        }

        const bucket = body.source ?? "webhook";
        if (isRateLimited(bucket)) {
            res.writeHead(429, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Rate limit exceeded" }));
            return;
        }

        const sessionName = body.session ?? nest.sessions.getDefault();
        if (!nest.sessions.list().includes(sessionName)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Unknown session: ${sessionName}` }));
            return;
        }

        const prefix = body.source ? `[webhook ${body.source}]` : "[webhook]";
        const prompt = `${prefix} ${body.message}`;

        try {
            const response = await nest.sessions.sendMessage(sessionName, prompt);
            await nest.sessions.broadcast(sessionName, response);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, response }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
    });

    nest.log.info("Webhook plugin loaded");
}
