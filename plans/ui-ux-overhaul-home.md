# Plan d'Implémentation - UI/UX Overhaul (Objectif 100/100)

**Version Cible : 7.0.0-UI-UX-ULTIMATE**

Ce plan détaille les modifications nécessaires pour implémenter les recommandations du rapport d'évaluation et atteindre un score de 100/100.

## 1. Recherche Instantanée (Mobile-like & Instant)

**Problème** : La recherche actuelle nécessite validation ou est trop basique.
**Solution** : Recherche en temps réel (Debounce) avec filtres visuels.

### Modifications :

- **`browser.html`** :
  - Repenser la barre de recherche : plus large, centrée, avec une animation au focus.
  - Ajouter une zone de "Chips" (Filtres rapides) sous la barre : "Tous", "Récents", "Mieux notés".
- **`browser.js`** :
  - Implémenter un filtrage côté client sur la liste `state.items` actuelle pour une réponse immédiate (< 100ms).
  - Ajouter un `debounce` sur l'input de recherche.

## 2. Cartes "Rich Hover" & Micro-interactions

**Problème** : Les cartes manquent de détails sans cliquer.
**Solution** : Révéler les métadonnées au survol (souris) ou focus (clavier).

### Modifications :

- **`browser.js`** / **`renderItems`** :
  - Injecter plus de données dans le DOM de la carte : `data-year`, `data-rating`, `data-plot` (court).
  - Structure HTML enrichie :
    ```html
    <div class="hover-overlay">
      <span class="meta-quality">4K</span>
      <span class="meta-rating">★ 8.5</span>
      <p class="meta-plot">Synopsis court...</p>
      <button class="btn-quick-play">▶</button>
    </div>
    ```
- **`styles.css`** :
  - Styles pour l'overlay apparaissant au `hover`.
  - Transition fluide `transform: translateY` pour l'apparition.

## 3. Placeholders "Shimmer" Premium

**Problème** : Les icônes grises sont tristes.
**Solution** : Squelettes animés "Shimmer" (effet de vague de lumière).

### Modifications :

- **`styles.css`** :
  - Créer une classe `.poster-placeholder.shimmer`.
  - Animation `@keyframes shimmer` avec dégradé linéaire.
  - Remplacer les SVG "dossier" par des dégradés de couleurs subtils basés sur le type de contenu (Bleu pour Live, Violet pour Films...).

## 4. Mode Cinéma (Immersion)

**Problème** : Le header prend de la place lors du scroll.
**Solution** : Masquer le header/tabs intelligemment lors du défilement vers le bas.

### Modifications :

- **`browser.js`** :
  - `scroll` event listener.
  - Détecter la direction du scroll.
  - Ajouter/retirer classe `.scrolled-down` sur le `body`.
- **`styles.css`** :
  - `header.header { transition: transform 0.3s; }`
  - `body.scrolled-down .header { transform: translateY(-100%); }`

## 5. Timeline d'Exécution

1.  **Étape 1 : Styles & Placeholders** (CSS pur, impact visuel immédiat).
2.  **Étape 2 : Cartes Enrichies** (JS + CSS, amélioration de l'information).
3.  **Étape 3 : Logique de Recherche** (JS, amélioration fonctionnelle).
4.  **Étape 4 : Mode Cinéma & Polish** (JS + CSS, finition).

---

## Fichiers Impactés

- `styles.css` (Gros changements visuels)
- `browser.html` (Structure de recherche)
- `browser.js` (Logique de rendu et events)
