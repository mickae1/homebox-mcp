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
    api.defaults.headers.common["Authorization"] = token!.startsWith("Bearer ") ? token : `Bearer ${token}`;
    console.error("[LOGIN] Connecte a Homebox");
}

async function ensureAuth() {
    if (!token) await login();
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
        // --- Items ---
        {
            name: "search_items",
            description: "Recherche des objets dans l'inventaire Homebox par mot-cle",
            inputSchema: {
                type: "object" as const,
                properties: {
                    query: { type: "string", description: "Terme de recherche" },
                    location: { type: "string", description: "ID d'un emplacement pour filtrer" },
                    labels: { type: "array", items: { type: "string" }, description: "IDs de labels pour filtrer" },
                },
                required: ["query"],
            },
        },
        {
            name: "get_item",
            description: "Recupere les details complets d'un objet par son ID",
            inputSchema: {
                type: "object" as const,
                properties: { id: { type: "string", description: "ID de l'objet" } },
                required: ["id"],
            },
        },
        {
            name: "create_item",
            description: "Ajoute un nouvel objet dans l'inventaire Homebox",
            inputSchema: {
                type: "object" as const,
                properties: {
                    name: { type: "string", description: "Nom de l'objet" },
                    description: { type: "string", description: "Description de l'objet" },
                    locationId: { type: "string", description: "ID de l'emplacement de stockage" },
                    labelIds: { type: "array", items: { type: "string" }, description: "IDs des labels a associer" },
                },
                required: ["name"],
            },
        },
        {
            name: "update_item",
            description: "Met a jour un objet existant dans l'inventaire",
            inputSchema: {
                type: "object" as const,
                properties: {
                    id: { type: "string", description: "ID de l'objet a modifier" },
                    name: { type: "string", description: "Nouveau nom" },
                    description: { type: "string", description: "Nouvelle description" },
                    locationId: { type: "string", description: "Nouvel emplacement (ID)" },
                    labelIds: { type: "array", items: { type: "string" }, description: "Nouveaux labels (IDs)" },
                    quantity: { type: "number", description: "Quantite" },
                    manufacturer: { type: "string", description: "Fabricant" },
                    modelNumber: { type: "string", description: "Numero de modele" },
                    serialNumber: { type: "string", description: "Numero de serie" },
                    notes: { type: "string", description: "Notes" },
                },
                required: ["id"],
            },
        },
        {
            name: "delete_item",
            description: "Supprime un objet de l'inventaire",
            inputSchema: {
                type: "object" as const,
                properties: { id: { type: "string", description: "ID de l'objet a supprimer" } },
                required: ["id"],
            },
        },
        // --- Locations ---
        {
            name: "list_locations",
            description: "Liste tous les emplacements de stockage dans Homebox",
            inputSchema: { type: "object" as const, properties: {} },
        },
        {
            name: "create_location",
            description: "Cree un nouvel emplacement de stockage",
            inputSchema: {
                type: "object" as const,
                properties: {
                    name: { type: "string", description: "Nom de l'emplacement" },
                    description: { type: "string", description: "Description" },
                    parentId: { type: "string", description: "ID de l'emplacement parent (optionnel)" },
                },
                required: ["name"],
            },
        },
        // --- Labels ---
        {
            name: "list_labels",
            description: "Liste tous les labels/categories dans Homebox",
            inputSchema: { type: "object" as const, properties: {} },
        },
        {
            name: "create_label",
            description: "Cree un nouveau label/categorie",
            inputSchema: {
                type: "object" as const,
                properties: {
                    name: { type: "string", description: "Nom du label" },
                    description: { type: "string", description: "Description" },
                },
                required: ["name"],
            },
        },
        // --- Statistics ---
        {
            name: "get_statistics",
            description: "Recupere les statistiques globales de l'inventaire (nombre d'objets, valeur totale, etc.)",
            inputSchema: { type: "object" as const, properties: {} },
        },
    ],
}));

// Logique des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await ensureAuth();

    const args = request.params.arguments ?? {};
    console.error(`[TOOL] Appel: ${request.params.name}`, args);

    try {
        switch (request.params.name) {
            // --- Items ---
            case "search_items": {
                const params: Record<string, unknown> = { q: args.query };
                if (args.location) params.locations = [args.location];
                if (args.labels) params.labels = args.labels;
                const res = await api.get("/api/v1/items", { params });
                console.error(`[TOOL] search_items: ${res.data.items?.length ?? 0} resultats`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            case "get_item": {
                const res = await api.get(`/api/v1/items/${args.id}`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            case "create_item": {
                const body: Record<string, unknown> = { name: args.name };
                if (args.description) body.description = args.description;
                if (args.locationId) body.locationId = args.locationId;
                if (args.labelIds) body.labelIds = args.labelIds;
                const res = await api.post("/api/v1/items", body);
                console.error(`[TOOL] create_item: ${res.data.id}`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            case "update_item": {
                const current = await api.get(`/api/v1/items/${args.id}`);
                const body = { ...current.data };
                if (args.name !== undefined) body.name = args.name;
                if (args.description !== undefined) body.description = args.description;
                if (args.locationId !== undefined) body.locationId = args.locationId;
                if (args.labelIds !== undefined) body.labelIds = args.labelIds;
                if (args.quantity !== undefined) body.quantity = args.quantity;
                if (args.manufacturer !== undefined) body.manufacturer = args.manufacturer;
                if (args.modelNumber !== undefined) body.modelNumber = args.modelNumber;
                if (args.serialNumber !== undefined) body.serialNumber = args.serialNumber;
                if (args.notes !== undefined) body.notes = args.notes;
                const res = await api.put(`/api/v1/items/${args.id}`, body);
                console.error(`[TOOL] update_item: ${args.id}`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            case "delete_item": {
                await api.delete(`/api/v1/items/${args.id}`);
                console.error(`[TOOL] delete_item: ${args.id}`);
                return { content: [{ type: "text" as const, text: `Objet ${args.id} supprime` }] };
            }
            // --- Locations ---
            case "list_locations": {
                const res = await api.get("/api/v1/locations");
                console.error(`[TOOL] list_locations: ${res.data.length ?? 0} emplacements`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            case "create_location": {
                const body: Record<string, unknown> = { name: args.name };
                if (args.description) body.description = args.description;
                if (args.parentId) body.parentId = args.parentId;
                const res = await api.post("/api/v1/locations", body);
                console.error(`[TOOL] create_location: ${res.data.id}`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            // --- Labels ---
            case "list_labels": {
                const res = await api.get("/api/v1/labels");
                console.error(`[TOOL] list_labels: ${res.data.length ?? 0} labels`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            case "create_label": {
                const body: Record<string, unknown> = { name: args.name };
                if (args.description) body.description = args.description;
                const res = await api.post("/api/v1/labels", body);
                console.error(`[TOOL] create_label: ${res.data.id}`);
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            // --- Statistics ---
            case "get_statistics": {
                const res = await api.get("/api/v1/groups/statistics");
                return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
            }
            default:
                throw new Error(`Outil inconnu: ${request.params.name}`);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[TOOL] Erreur: ${message}`);
        return { content: [{ type: "text" as const, text: `Erreur: ${message}` }], isError: true };
    }
});

// 4. Exposition via Express (SSE) - supporte plusieurs clients
const app = express();
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
    console.error(`[SSE] Nouvelle connexion depuis ${req.ip}`);
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);
    console.error(`[SSE] Session ${transport.sessionId} creee`);

    res.on("close", () => {
        console.error(`[SSE] Session ${transport.sessionId} fermee`);
        transports.delete(transport.sessionId);
    });

    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    console.error(`[MSG] Requete pour session ${sessionId}`);
    const transport = transports.get(sessionId);
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        console.error(`[MSG] Session ${sessionId} introuvable`);
        res.status(400).json({ error: "Session inconnue" });
    }
});

app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "homebox-mcp", version: "1.0.0" });
});

app.listen(PORT, () => {
    console.error(`Serveur MCP v1.0.0 pret sur le port ${PORT}`);
});
