import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import axios from "axios";

// 1. Configuration via Variables d'Environnement (Docker)
const HOMEBOX_URL = process.env.HOMEBOX_URL || "http://localhost:7745";
const EMAIL = process.env.HOMEBOX_EMAIL;
const PASSWORD = process.env.HOMEBOX_PASSWORD;
const PORT = process.env.PORT || 3000;

// 2. Client Homebox avec Auth Automatique
const api = axios.create({ baseURL: HOMEBOX_URL });
let token: string | null = null;

async function login() {
    const res = await api.post("/api/v1/users/login", { username: EMAIL, password: PASSWORD });
    token = res.data.token;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    console.error("Connecte a Homebox");
}

// 3. Creation du Serveur MCP
const server = new Server({
    name: "homebox-syno-server",
    version: "1.0.0",
}, {
    capabilities: { tools: {} },
});

// Declaration des outils (Tools)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "search_items",
            description: "Recherche un objet dans l'inventaire Homebox",
            inputSchema: {
                type: "object" as const,
                properties: { query: { type: "string", description: "Terme de recherche" } },
                required: ["query"],
            },
        },
        {
            name: "list_locations",
            description: "Liste tous les lieux de stockage dans Homebox",
            inputSchema: { type: "object" as const, properties: {} },
        }
    ],
}));

// Logique des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!token) await login();

    try {
        switch (request.params.name) {
            case "search_items": {
                const searchRes = await api.get("/api/v1/items", { params: { q: request.params.arguments?.query } });
                return { content: [{ type: "text" as const, text: JSON.stringify(searchRes.data, null, 2) }] };
            }
            case "list_locations": {
                const locRes = await api.get("/api/v1/locations");
                return { content: [{ type: "text" as const, text: JSON.stringify(locRes.data, null, 2) }] };
            }
            default:
                throw new Error(`Outil inconnu: ${request.params.name}`);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `Erreur: ${message}` }], isError: true };
    }
});

// 4. Exposition via Express (SSE) - supporte plusieurs clients
const app = express();
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    res.on("close", () => {
        transports.delete(transport.sessionId);
    });

    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).json({ error: "Session inconnue" });
    }
});

app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "homebox-mcp" });
});

app.listen(PORT, () => {
    console.error(`Serveur MCP pret sur le port ${PORT}`);
});
