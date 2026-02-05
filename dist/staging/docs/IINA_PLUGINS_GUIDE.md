# Guide Complet des Plugins IINA (2026)

> Ce document est une référence complète pour le développement de plugins IINA en 2026. Il couvre les bases ainsi que les pratiques modernes de développement (Bundling, TypeScript).

## Table des matières

1. [Introduction](#introduction)
2. [Prérequis](#prérequis)
3. [Structure d'un Plugin](#structure-dun-plugin)
4. [Fichier Info.json](#fichier-infojson)
5. [Points d'Entrée](#points-dentrée)
6. [Modules de l'API](#modules-de-lapi)
7. [Interfaces Utilisateur](#interfaces-utilisateur)
8. [Outils de Développement](#outils-de-développement)
9. [Développement Moderne (Bundling)](#développement-moderne)
10. [Distribution](#distribution)
11. [Bonnes Pratiques](#bonnes-pratiques)

---

## Introduction

Le système de plugins IINA, mature en 2026, est basé sur l'architecture introduite dans la version **1.4.0**. Il permet d'étendre les fonctionnalités du lecteur via **JavaScript** et offre des possibilités avancées d'intégration système.

### Environnement d'Exécution & Limitations

Il est crucial de comprendre que les plugins IINA ne s'exécutent **ni dans un navigateur complet, ni dans un environnement Node.js complet**.

- **Runtime JS** : Un environnement "Node-flavor" limité. Vous avez accès à `require()` et `module.exports`, mais pas aux modules natifs Node.js (comme `fs` complet, `http` serveur, etc.) ni aux globales navigateur (`window`, `localstorage`, `fetch`).
- **WebViews Isolées** : Les interfaces graphiques (fenêtres, overlays) tournent dans des processus WebViews séparés. Elles ne partagent **pas** le même contexte mémoire que le script principal du plugin. La communication se fait uniquement via messages asynchrones.
- **Dépendances** : Pour utiliser des bibliothèques NPM tierces, l'utilisation d'un **Bundler** (Parcel/Webpack) est indispensable, car le runtime ne peut pas résoudre les `node_modules` dynamiquement typiques.

### Capacités des Plugins

| Fonctionnalité           | Description                                      |
| ------------------------ | ------------------------------------------------ |
| **Contrôle de lecture**  | Gérer la lecture, fenêtre, pistes de sous-titres |
| **API mpv**              | Accès direct aux propriétés et hooks mpv         |
| **Gestion d'événements** | Écouter les événements IINA et mpv               |
| **Réseau**               | Requêtes HTTP, XMLRPC, WebSocket                 |
| **Système de fichiers**  | Accès aux fichiers utilisateur                   |
| **Playlists**            | Manipulation et menus contextuels                |
| **Sous-titres**          | Enregistrer des téléchargeurs personnalisés      |
| **UI personnalisée**     | Overlays, sidebar, fenêtres standalone           |

---

## Prérequis

- **macOS 10.14** ou supérieur
- **IINA 1.4.0** ou supérieur
- Connaissances en **JavaScript** (ES6+)
- Éditeur de code (VS Code recommandé)

---

## Structure d'un Plugin

Un plugin IINA minimal nécessite deux fichiers :

```
MonPlugin/
├── Info.json         # Manifeste du plugin (obligatoire)
├── main.js           # Point d'entrée principal
├── global.js         # Point d'entrée global (optionnel)
├── Preferences.xib   # Interface de préférences (optionnel)
└── src/              # Code source organisé
    ├── api/
    ├── ui/
    └── managers/
```

---

## Fichier Info.json

Le fichier `Info.json` définit les métadonnées et permissions du plugin :

```json
{
  "name": "Mon Plugin",
  "identifier": "com.example.mon-plugin",
  "version": "1.0.0",
  "description": "Description du plugin",
  "author": {
    "name": "Votre Nom",
    "email": "email@example.com",
    "url": "https://example.com"
  },
  "entry": "main.js",
  "globalEntry": "global.js",
  "permissions": [
    "network",
    "file-system",
    "show-overlay",
    "show-alert",
    "menu",
    "preferences",
    "playlist",
    "standalone-window"
  ],
  "preferencePages": [
    {
      "id": "settings",
      "title": "Paramètres",
      "xib": "Preferences.xib"
    }
  ],
  "ghRepo": "username/repo",
  "ghVersion": "1.0.0"
}
```

### Permissions Disponibles

| Permission          | Description                  |
| ------------------- | ---------------------------- |
| `network`           | Requêtes HTTP/WebSocket      |
| `file-system`       | Accès au système de fichiers |
| `show-overlay`      | Afficher des overlays vidéo  |
| `show-alert`        | Afficher des alertes système |
| `menu`              | Ajouter des menus            |
| `preferences`       | Page de préférences          |
| `playlist`          | Manipulation de playlist     |
| `standalone-window` | Fenêtres indépendantes       |
| `sidebar`           | Onglets dans la sidebar      |

---

## Points d'Entrée

### Entry (main.js)

Exécuté dans le contexte de chaque lecteur. Chaque fenêtre IINA a sa propre instance.

```javascript
// main.js - Contexte par lecteur
iina.console.log("Plugin chargé pour ce lecteur");

iina.event.on("iina.file-loaded", () => {
  const path = iina.core.file;
  iina.console.log(`Fichier chargé: ${path}`);
});
```

### Global Entry (global.js)

Exécuté une seule fois au démarrage d'IINA, indépendant des lecteurs.

```javascript
// global.js - Instance unique
iina.menu.addItem(
  iina.menu.item("Mon Action", () => {
    iina.console.log("Action exécutée");
  }),
);

iina.console.log("Plugin global initialisé");
```

---

## Modules de l'API

### iina.core

Gestion de la lecture et du lecteur :

```javascript
// Ouvrir un fichier
iina.core.open("https://example.com/video.mp4");

// Obtenir le fichier actuel
const file = iina.core.file;

// Afficher un message OSD
iina.core.osd("Message affiché");

// Contrôles de lecture
iina.core.pause();
iina.core.resume();
iina.core.stop();
```

### iina.mpv

Accès direct à l'API mpv :

```javascript
// Obtenir une propriété mpv
const position = iina.mpv.getNumber("time-pos");
const duration = iina.mpv.getNumber("duration");
const volume = iina.mpv.getNumber("volume");

// Définir une propriété
iina.mpv.set("volume", 80);
iina.mpv.set("speed", 1.5);

// Exécuter une commande mpv
iina.mpv.command("seek", ["10", "relative"]);
```

### iina.event

Gestion des événements :

```javascript
// Événements IINA
iina.event.on("iina.file-loaded", () => {
  /* ... */
});
iina.event.on("iina.window-will-close", () => {
  /* ... */
});

// Événements mpv
iina.event.on("mpv.pause", () => {
  /* ... */
});
iina.event.on("mpv.end-file", () => {
  /* ... */
});

// Observer les propriétés mpv
iina.event.on("mpv.time-pos.changed", (value) => {
  console.log(`Position: ${value}s`);
});
```

### iina.http

Requêtes réseau :

```javascript
// GET request
iina.http.get(
  "https://api.example.com/data",
  {
    timeout: 10000,
    headers: { "User-Agent": "IINA-Plugin/1.0" },
  },
  (error, response) => {
    if (error) {
      iina.console.error("Erreur: " + error.message);
      return;
    }
    const data = JSON.parse(response.text);
    iina.console.log("Données reçues: " + data.length + " items");
  },
);

// POST request
iina.http.post(
  "https://api.example.com/submit",
  {
    body: JSON.stringify({ key: "value" }),
    headers: { "Content-Type": "application/json" },
  },
  callback,
);
```

### iina.preferences

Stockage des préférences :

```javascript
// Sauvegarder
iina.preferences.set("server", "http://example.com");
iina.preferences.set("username", "user123");

// Récupérer
const server = iina.preferences.get("server") || "";
const username = iina.preferences.get("username") || "";

// Vérifier l'existence
const hasCredentials = iina.preferences.get("server") !== null;
```

### iina.menu

Ajout de menus :

```javascript
// Ajouter un item de menu
iina.menu.addItem(
  iina.menu.item("Mon Action", () => {
    // Action à exécuter
  }),
);

// Menu avec raccourci clavier
iina.menu.addItem(
  iina.menu.item("Raccourci", myFunction, {
    key: "t",
    modifiers: ["cmd", "shift"],
  }),
);

// Sous-menu
iina.menu.addItem(
  iina.menu.item("Sous-menu", [
    iina.menu.item("Option 1", action1),
    iina.menu.item("Option 2", action2),
  ]),
);
```

### iina.playlist

Gestion de la playlist :

```javascript
// Obtenir les items
const items = iina.playlist.items;

// Ajouter un item
iina.playlist.add("https://example.com/video.mp4");

// Supprimer un item
iina.playlist.remove(0);

// Jouer un item spécifique
iina.playlist.playAt(2);
```

### iina.file

Accès au système de fichiers (nécessite la permission `file-system`) :

```javascript
// Lister les fichiers d'un dossier
// Retourne une Promise<string[]>
const files = await iina.file.list("/Users/user/Documents");

// Option récursive
const allFiles = await iina.file.list("/path", { recursive: true });

// Lire un fichier texte
// Retourne une Promise<string>
const content = await iina.file.read("/path/to/file.txt");

// Écrire dans un fichier
iina.file.write("/path/to/file.txt", "Nouveau contenu");

// Dossiers spéciaux (Pseudo-folders)
// @tmp/ : Dossier temporaire du plugin
// @data/ : Dossier de données persistant du plugin
iina.file.write("@data/config.json", JSON.stringify(config));
```

### iina.utils

Utilitaires système et interface native :

```javascript
// Exécuter une commande shell
// Note: Bloquant ou asynchrone selon l'implémentation, vérifier la doc spécifique
// Retourne généralement { status, stdout, stderr }
const result = iina.utils.exec("/bin/ls", ["-la"]);
if (result.status === 0) {
  iina.console.log(result.stdout);
}

// Afficher une alerte native (nécessite la permission `show-alert`)
iina.utils.showAlert({
  title: "Attention",
  message: "Voulez-vous continuer ?",
  buttons: ["Oui", "Non"],
});

// Ouvrir un sélecteur de fichier
const selected = iina.utils.showOpenPanel({
  canChooseFiles: true,
  canChooseDirectories: false,
  allowsMultipleSelection: false,
});
if (selected) {
  iina.console.log("Fichier choisi : " + selected);
}
```

### iina.input

Gestion bas niveau des entrées (Clavier/Souris) :

```javascript
// Écouter les événements clavier
// Retourner `true` pour empêcher la propagation (stop propagation)
iina.input.on("keyDown", (key) => {
  // key contient : name, keycode, headers, etc.
  if (key.name === "s" && key.meta) {
    saveWork();
    return true; // Bloque le raccourci par défaut
  }
  return false;
});

// Événements souris
iina.input.on("mouseDown", (event) => {
  // event contient x, y, button
  iina.console.log(`Clic à ${event.x}, ${event.y}`);
});

// Normaliser les codes touches mpv
const normalized = iina.input.normalizeKeyCode(mpvKeyCode);
```

### iina.ws

Gestion des WebSockets (Client) :

```javascript
// Créer une connexion
const ws = new iina.ws("wss://echo.websocket.org");

ws.onopen = () => {
  iina.console.log("Connecté au WebSocket");
  ws.send("Hello IINA");
};

ws.onmessage = (event) => {
  iina.console.log("Reçu : " + event.data);
};

ws.onclose = () => {
  iina.console.log("Connexion fermée");
};

ws.onerror = (error) => {
  iina.console.error("Erreur WS : " + error);
};
```

### iina.global

Gestion globale des instances de lecteur (disponible uniquement dans `global.js`) :

```javascript
// Créer une nouvelle fenêtre de lecteur
const player = iina.global.newWindow({
  disableWindowAnimation: false,
  disableUI: false,
});

// Ouvrir une URL dans cette fenêtre
player.open("https://example.com/video.mp4");

// Contrôler l'instance
player.postMessage("custom-action", { cmd: "play" });
```

### iina.console

Logging et débogage :

```javascript
iina.console.log("Information");
iina.console.warn("Avertissement");
iina.console.error("Erreur");
```

---

## Interfaces Utilisateur

### Standalone Window

Fenêtres indépendantes avec contenu HTML :

```javascript
const win = iina.standaloneWindow.open({
  title: "Ma Fenêtre",
  width: 400,
  height: 600,
  resizable: true,
  onMessage: (msg, data) => {
    // Messages depuis le webview
    if (msg === "action") {
      handleAction(data);
    }
  },
  onClose: () => {
    // Nettoyage
  },
});

// Mode simple (sans chrome macOS)
win.simpleMode();

// Définir le style CSS
win.setStyle(`
  body { 
    background: #1e1e1e; 
    color: #fff; 
    font-family: -apple-system, sans-serif; 
  }
`);

// Définir le contenu HTML
win.setContent(`
  <h1>Titre</h1>
  <button onclick="iina.postMessage('action', {id: 1})">
    Cliquer
  </button>
`);

// Exécuter du JavaScript
win.evaluate(`document.getElementById('input').value = 'test';`);

// Afficher la fenêtre
win.show();
```

### Sidebar

Ajouter un onglet dans la sidebar IINA :

```javascript
const sidebar = iina.sidebar.create({
  tabId: "mon-plugin",
  html: "src/ui/sidebar.html",
  width: 320,
  onLoad: () => {
    // HTML chargé
  },
  onMessage: (data) => {
    // Messages depuis le webview
  },
});

sidebar.show();
sidebar.hide();
sidebar.evaluate(`window.refresh();`);
```

### Overlay

Afficher du contenu par-dessus la vidéo :

```javascript
const overlay = iina.overlay.show({
  html: "<div class='overlay'>Information</div>",
  css: ".overlay { color: white; background: rgba(0,0,0,0.7); }",
  position: "bottom-right",
});

// Masquer après 3 secondes
setTimeout(() => overlay.hide(), 3000);
```

---

## Outils de Développement

### CLI iina-plugin

L'outil en ligne de commande est inclus avec IINA :

```bash
# Créer un lien symbolique (une seule fois)
ln -s /Applications/IINA.app/Contents/MacOS/iina-plugin /usr/local/bin/iina-plugin

# Créer un nouveau plugin
iina-plugin create mon-plugin

# Créer avec template (React, Vue)
iina-plugin create mon-plugin --template react
iina-plugin create mon-plugin --template vue

# Packager le plugin
iina-plugin pack .

# Lancer en mode développement
iina-plugin run .
```

### Types TypeScript

Pour l'autocomplétion dans VS Code :

```bash
npm install --save-dev iina-plugin-definition
```

Créer un fichier `jsconfig.json` :

```json
{
  "compilerOptions": {
    "checkJs": true,
    "target": "ES6"
  },
  "include": ["**/*.js"],
  "typeAcquisition": {
    "include": ["iina-plugin-definition"]
  }
}
```

### Débogage avec Safari

1. Activer le menu Développeur dans Safari
   - Safari → Préférences → Avancées → "Afficher le menu Développeur"

2. Ouvrir l'inspecteur
   - Développer → IINA → [contexte du plugin]

3. Utiliser la console JavaScript pour déboguer

### Développement en symlink

Pour tester sans réinstaller à chaque modification :

```bash
# Créer un lien vers le dossier des plugins IINA
ln -s /chemin/vers/MonPlugin ~/Library/Application\ Support/com.colliderli.iina/plugins/MonPlugin
```

---

---

## Développement Moderne

En 2026, la pratique standard n'est plus d'écrire du JS brut, mais d'utiliser des outils modernes pour garantir la robustesse et l'accès à l'écosystème NPM.

### Pourquoi utiliser un Bundler ?

Le runtime IINA ne supporte pas nativement les imports ES6 (`import/export`) ni la résolution de dossiers `node_modules` complexes. Utiliser **Parcel** ou **Webpack** permet de :

1.  Utiliser **TypeScript** pour la sécurité de typage.
2.  Importer des librairies **NPM** (ex: `date-fns`, `lodash`).
3.  Utiliser la syntaxe **ES6+** moderne.
4.  Minifier le code pour la production.

### Workflow Recommendé avec Parcel

IINA recommande officiellement **Parcel** pour sa simplicité "zéro-config".

1.  **Initialisation** :

    ```bash
    npm init -y
    npm install --save-dev parcel iina-plugin-definition typescript
    ```

2.  **Configuration (package.json)** :

    ```json
    {
      "scripts": {
        "dev": "parcel watch src/main.ts --target main --no-hmr",
        "build": "parcel build src/main.ts --target main"
      },
      "targets": {
        "main": {
          "distDir": "./",
          "includeNodeModules": true,
          "context": "node",
          "outputFormat": "commonjs"
        }
      }
    }
    ```

    _Note : On cible `context: "node"` et `outputFormat: "commonjs"` car IINA attend un `require()` classique._

3.  **Structure Moderne** :
    ```
    src/
      main.ts       # Point d'entrée
      ui/           # Composants React/Web
      utils/        # Logique
    package.json
    tsconfig.json
    Info.json
    ```

### Templates Officiels

La CLI `iina-plugin` permet de générer des projets pré-configurés avec ce workflow :

```bash
# Template avec React pour l'interface
iina-plugin create mon-plugin --template react

# Template avec Vue
iina-plugin create mon-plugin --template vue
```

---

## Distribution

### Via GitHub (recommandé)

1. Créer un repository GitHub
2. Ajouter les champs dans `Info.json` :

```json
{
  "ghRepo": "username/mon-plugin",
  "ghVersion": "1.0.0"
}
```

3. Créer une release GitHub avec le fichier `.iinaplgz`
4. Les utilisateurs installent via : IINA → Préférences → Plugins → "+"

### Fichier .iinaplgz

```bash
# Créer le package
/Applications/IINA.app/Contents/MacOS/iina-plugin pack .

# Le fichier MonPlugin-1.0.0.iinaplgz est créé
# Double-cliquer pour installer
```

---

## Bonnes Pratiques

### Architecture

```javascript
// Séparer les responsabilités
// api/ - Communication avec les APIs externes
// ui/ - Interfaces utilisateur
// managers/ - Logique métier (favorites, history, etc.)
// utils/ - Fonctions utilitaires
```

### Gestion des erreurs

```javascript
iina.http.get(url, options, (error, response) => {
  if (error) {
    iina.console.error(`[MonPlugin] Erreur réseau: ${error.message}`);
    showErrorUI("Connexion impossible");
    return;
  }

  try {
    const data = JSON.parse(response.text);
    processData(data);
  } catch (e) {
    iina.console.error(`[MonPlugin] Erreur parsing: ${e.message}`);
  }
});
```

### Cache et performance

```javascript
class APIClient {
  constructor() {
    this.cache = {
      categories: null,
      lastFetch: 0,
    };
  }

  async getCategories() {
    const now = Date.now();
    // Cache valide pendant 5 minutes
    if (this.cache.categories && now - this.cache.lastFetch < 300000) {
      return this.cache.categories;
    }

    const data = await this.fetchCategories();
    this.cache.categories = data;
    this.cache.lastFetch = now;
    return data;
  }
}
```

### Logs structurés

```javascript
const LOG_PREFIX = "[MonPlugin]";

function log(message) {
  iina.console.log(`${LOG_PREFIX} ${message}`);
}

function logError(context, error) {
  iina.console.error(`${LOG_PREFIX} ${context}: ${error.message}`);
}
```

---

## Ressources

- **Documentation officielle** : [iina.io/plugin](https://iina.io/plugin)
- **API Reference** : [iina.io/plugin/api](https://iina.io/plugin/api)
- **GitHub IINA** : [github.com/iina/iina](https://github.com/iina/iina)
- **Types TypeScript** : `npm install iina-plugin-definition`

---

_Documentation créée le 2 février 2026 - Compatible IINA 1.4.0+_
