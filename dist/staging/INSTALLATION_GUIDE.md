# Guide d'Installation et de Débogage - Plugin IPTV IINA v3.0.0-WORKING

## 📋 Résumé des corrections apportées

### Problèmes identifiés et corrigés :

1. **Gestion d'erreur robuste pour l'enregistrement du menu**
   - Ajout de try-catch autour de l'enregistrement du menu
   - Vérification de la disponibilité des API IINA avant utilisation
   - Logging détaillé pour diagnostiquer les problèmes

2. **Vérification de la disponibilité de `iina.utils.exec`**
   - Ajout d'une vérification avant d'utiliser `iina.utils.exec`
   - Message d'erreur clair si l'API n'est pas disponible

3. **Amélioration du fichier Info.json**
   - Ajout du champ `minIINAVersion` pour la compatibilité
   - Version mise à jour (3.0.0-WORKING)

4. **⭐ CRITIQUE : Correction du chargement infini VOD/Séries**
   - **Root cause** : Les handlers de messages étaient enregistrés AVANT le chargement de la nouvelle page, donc ils n'étaient pas actifs dans le nouveau contexte
   - **Solution** : Ré-enregistrement des handlers APRÈS le chargement de la page (délai de 200ms) avec réinitialisation du flag
   - **Logging amélioré** : Ajout de logs immédiats dans le callback `win.onMessage('load')` pour confirmer la réception
   - Maintenant tous les changements d'onglets (Live TV, VOD, Series) fonctionnent correctement

5. **Améliorations supplémentaires**
   - Handlers globaux pour les erreurs non gérées
   - Logging immédiat au début des fonctions de chargement
   - Wrapper try-catch complet autour de toutes les fonctions async
   - Envoi systématique de réponses au frontend (même en cas d'erreur)
   - Protection contre timeout sur toutes les requêtes API
   - Acknowledgment `loadReceived` pour confirmer la réception des messages

## 🚀 Instructions d'installation

### Étape 1 : Supprimer l'ancien plugin

1. Ouvrez IINA
2. Allez dans **IINA → Preferences → Plugins**
3. Localisez "IPTV Player" dans la liste
4. Cliquez sur le bouton **Supprimer** ou **Uninstall**

### Étape 2 : Supprimer manuellement les fichiers résiduels (si nécessaire)

```bash
# Ouvrir le Terminal et exécuter :
rm -rf ~/Library/Application\ Support/com.colliderli.iina/plugins/IPTV_INNA*
```

### Étape 3 : Installer le nouveau plugin

1. Double-cliquez sur le fichier **`IPTV_INNA-2.7.2-FIXED.iinaplgz`**
2. IINA devrait s'ouvrir automatiquement et confirmer l'installation
3. Alternativement :
   - Ouvrez IINA
   - Allez dans **IINA → Preferences → Plugins**
   - Cliquez sur **+** et sélectionnez le fichier `.iinaplgz`

### Étape 4 : Vérifier l'installation

1. Dans IINA, allez dans **IINA → Plugin**
2. Vous devriez voir **"Open IPTV"** dans le menu
3. Cliquez dessus pour ouvrir la fenêtre de connexion

## 🔍 Débogage

### Vérifier la console IINA

Si le plugin n'apparaît pas dans le menu :

1. Ouvrez IINA
2. Allez dans **Window → Console** (ou **Fenêtre → Console**)
3. Cherchez les messages commençant par `[IPTV]`
4. Les messages d'erreur seront marqués avec `ERROR` ou `FATAL`

### Messages d'erreur courants

#### Erreur : "iina.menu API not available"
**Cause** : Version d'IINA trop ancienne
**Solution** : Mettez à jour IINA vers la dernière version

#### Erreur : "iina.utils.exec API not available"
**Cause** : Cette API n'est pas disponible dans votre version d'IINA
**Solution** : Mettez à jour IINA ou contactez le développeur

#### Erreur : "Failed to register menu item"
**Cause** : Permissions incorrectes ou fichier corrompu
**Solution** : Réinstallez le plugin complètement

### Recharger les plugins

Si vous avez modifié les fichiers du plugin :

1. Dans IINA, allez dans **IINA → Plugin → Reload All Plugins**
2. Ou redémarrez IINA complètement

## 📂 Emplacement des fichiers du plugin

Le plugin est installé dans :
```
~/Library/Application Support/com.colliderli.iina/plugins/
```

Pour voir les fichiers installés :
```bash
ls -la ~/Library/Application\ Support/com.colliderli.iina/plugins/
```

## 🔧 Réinstallation complète

Si rien ne fonctionne, effectuez une réinstallation complète :

```bash
# 1. Fermer IINA
killall IINA

# 2. Supprimer tous les fichiers du plugin
rm -rf ~/Library/Application\ Support/com.colliderli.iina/plugins/IPTV_INNA*

# 3. Supprimer les préférences (optionnel)
defaults delete com.colliderli.iina

# 4. Redémarrer IINA et réinstaller le plugin
open -a IINA
```

## 📞 Support

Si le problème persiste après avoir suivi ces instructions :

1. Consultez la console IINA (Window → Console)
2. Copiez les messages d'erreur `[IPTV]`
3. Vérifiez que vous utilisez la dernière version d'IINA
4. Consultez la documentation IINA : https://github.com/iina/iina/wiki

## 📝 Notes de version

### Version 3.0.0-WORKING (Dernière - Recommandée)
- ✅ **CORRECTION CRITIQUE : Chargement infini VOD/Séries RÉSOLU**
- ✅ **Root cause identifiée** : Handlers enregistrés avant le chargement de la page
- ✅ **Solution** : Ré-enregistrement des handlers APRÈS le chargement (200ms)
- ✅ **Logging avancé** : Logs immédiats dans le callback du message handler
- ✅ **Acknowledgment** : Message `loadReceived` pour confirmer la réception
- ✅ Tous les onglets fonctionnent maintenant (Live TV, VOD, Series, Favorites, History)
- ✅ Handlers globaux pour les erreurs non gérées
- ✅ Logging immédiat au début des fonctions de chargement
- ✅ Wrapper try-catch complet sur toutes les fonctions async
- ✅ Envoi systématique de réponses au frontend
- ✅ Protection contre timeout (10 secondes)
- ✅ Gestion d'erreur robuste pour l'enregistrement du menu
- ✅ Vérification de la disponibilité des API IINA
- ✅ Logging détaillé pour le débogage
- ✅ Messages d'erreur clairs et explicites

### Version 2.9.0-FINAL
- ✅ Tentative de correction avec flag anti-double enregistrement
- ⚠️ N'a pas résolu le problème complètement

### Version 2.8.0-LOADER-FIX
- ✅ Correction du chargement infini VOD/Séries
- ✅ Handlers globaux pour les erreurs non gérées

### Version 2.7.2-FIXED
- ✅ Gestion d'erreur robuste pour l'enregistrement du menu

### Version 2.7.1-DEBUG
- 🔨 Version de débogage avec logs visibles
