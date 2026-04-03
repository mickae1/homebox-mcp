# Homebox MCP Server

Serveur [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) pour [Homebox](https://github.com/sysadminsmedia/homebox), un système de gestion d'inventaire domestique.

Ce serveur permet à un assistant IA (comme Claude) d'interagir avec votre instance Homebox pour rechercher des objets et lister vos emplacements de stockage.

## Pourquoi SSE ?

Ce serveur utilise le transport **SSE (Server-Sent Events)** au lieu de stdio. Cela permet de l'exécuter sur une machine distante (NAS Synology, serveur, etc.) et de s'y connecter depuis n'importe quel client MCP sur le réseau. Le serveur reste accessible tant que le conteneur Docker tourne.

## Statut

✅ **Fonctionnel** — Testé et validé avec une instance Homebox.

## Outils disponibles

| Outil | Description |
|---|---|
| `search_items` | Recherche des objets dans l'inventaire par mot-clé, avec filtres par emplacement et labels |
| `get_item` | Récupère les détails complets d'un objet par son ID |
| `create_item` | Ajoute un nouvel objet dans l'inventaire |
| `update_item` | Met à jour un objet existant (nom, emplacement, labels, quantité...) |
| `delete_item` | Supprime un objet de l'inventaire |
| `list_locations` | Liste tous les emplacements de stockage |
| `create_location` | Crée un nouvel emplacement de stockage |
| `list_labels` | Liste tous les labels/catégories |
| `create_label` | Crée un nouveau label |
| `get_statistics` | Récupère les statistiques globales de l'inventaire |

## Installation avec Docker

### 1. Créer le dossier et la configuration

```bash
mkdir -p /volume1/docker/homebox-mcp
cd /volume1/docker/homebox-mcp
```

Créer un fichier `.env` :

```env
HOMEBOX_URL=http://192.168.1.X:7745
HOMEBOX_EMAIL=votre_email
HOMEBOX_PASSWORD=votre_mot_de_passe
```

### 2. Créer le fichier `docker-compose.yml`

```yaml
version: '3.8'
services:
  mcp-homebox:
    image: ghcr.io/mickae1/homebox-mcp:main
    container_name: mcp-homebox-syno
    restart: always
    ports:
      - "3000:3000"
    environment:
      - HOMEBOX_URL=${HOMEBOX_URL}
      - HOMEBOX_EMAIL=${HOMEBOX_EMAIL}
      - HOMEBOX_PASSWORD=${HOMEBOX_PASSWORD}
```

### 3. Lancer le conteneur

```bash
sudo docker-compose up -d
```

### 4. Vérifier que le serveur tourne

```bash
curl http://localhost:3000/health
```

## Configuration du client MCP

Ajoutez cette configuration dans votre client MCP (ex: Claude Desktop) :

```json
{
  "mcpServers": {
    "homebox": {
      "url": "http://IP_DU_SERVEUR:3000/sse"
    }
  }
}
```

Remplacez `IP_DU_SERVEUR` par l'adresse IP de la machine qui exécute le conteneur.

## Développement local

```bash
npm install
npm run build
npm run start
```
