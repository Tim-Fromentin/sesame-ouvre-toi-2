# Rapport de refactoring — 2ᵉ passage

> Périmètre : `model.js` · Date : 21/10/2026 · Rapport précédent : [REFACTOR.md](REFACTOR.md)
> Métriques : estimées à la main (aucun outil d'analyse installé dans le projet)

## Résumé

| Indicateur | Résultat | Avant | Appréciation |
|---|---|---|---|
| Note globale du code | **12,4 / 20** | 9,3 / 20 | Propre par endroits ; il reste de la duplication et de l'état global |
| Note de complexité | 20 / 20 | 20 / 20 | Aucune fonction au-dessus des seuils |
| Indice de maintenabilité | ≈ 55 / 100 (rang A) | ≈ 42 | Les fonctions sont plus petites, donc plus faciles à faire évoluer |
| Complexité cyclomatique | moyenne 2,4 · max 6 dans `validateOrderLine` (rang A) | moyenne 5 · max 9 | Le point chaud a été découpé |
| Définition de « terminé » | Marche : oui en apparence · Propre : pas encore | Marche : oui en apparence · Propre : non | Le fichier se charge sans erreur ; les cas à essayer à la main sont listés en fin de rapport |

Gros progrès : les noms disent maintenant ce que contiennent les variables, les schémas JSON sont sortis des handlers, le `console.log` a disparu, et les deux handlers ont été découpés (67 → 35 lignes et 46 → 24 lignes). Les trois chantiers qui restent : **supprimer les doublons entre la commande et le conseil**, **faire de `validateOrderLine` une vraie question**, **sortir les tableaux de messages de l'état global**.

## Ce qui a changé depuis le 1ᵉʳ passage

- [x] `console.log` de débogage supprimé.
- [x] Schémas JSON sortis des handlers (`orderAnswerFormat`, `adviceAnswerFormat`).
- [x] `handleSubmitAdviceForm` découpé (`clearSuggestions`, `addSuggestedIds`, `resetAdviceForm`) et son `try` réduit à l'appel à l'IA.
- [x] `handleSubmitOrderForm` découpé (`validateOrderLine`, `resetOrderForm`) et la préparation de l'interface sortie du `try`.
- [x] Identifiant français (`activeCategorie`) et noms trompeurs (`message`, `errorMsg`, `value`, `response`, `e`, `line` pour un id, `handleActiveCategorie`…) renommés.
- [x] `let errors` devenu `const`.
- [x] Bug introduit pendant le refactoring (messages ajoutés dans le mauvais tableau, `errors` hors de portée, `return` qui n'arrêtait plus l'ajout, `resetOrderForm` jamais appelée) : corrigé.

## Détail de la note globale

| Catégorie | Note | Avant | Poids |
|---|---|---|---|
| Nommage | 16 / 20 | 11 | 22 % |
| Fonctions | 12 / 20 | 7 | 28 % |
| Lisibilité et mise en forme | 12 / 20 | 12 | 11 % |
| Commentaires, code mort et duplication | 12 / 20 | 9 | 11 % |
| Objets, gestion des erreurs et frontières | 11 / 20 | 10 | 11 % |
| Classes, architecture et structure des dossiers | 10 / 20 | 9 | 17 % |
| **Total pondéré** | **12,4 / 20** | **9,3** | |

Note de complexité : 20 − 0 (aucune complexité cyclomatique > 10, aucune complexité cognitive > 15, aucune imbrication > 3 niveaux) = 20.

## Métriques par fonction

Les fonctions fléchées passées à `map`, `filter`, `forEach` sont comptées dans la fonction qui les contient. Lignes = lignes de la fonction, lignes vides comprises.

| Fichier | Fonction | Lignes | Arguments | Complexité cyclomatique | Complexité cognitive |
|---|---|---|---|---|---|
| model.js | `askModel` | 18 | 2 | 2 | 1 |
| model.js | `addMessages` | 4 | 3 | 1 | 0 |
| model.js | `validateOrderLine` | 19 | 3 | 6 | 4 |
| model.js | `resetOrderForm` | 5 | 0 | 1 | 0 |
| model.js | `handleSubmitOrderForm` | 35 | 1 | 5 | 6 |
| model.js | `clearSuggestions` | 5 | 0 | 1 | 0 |
| model.js | `addSuggestedIds` | 12 | 1 | 3 | 4 |
| model.js | `resetAdviceForm` | 5 | 0 | 1 | 0 |
| model.js | `handleSubmitAdviceForm` | 24 | 1 | 2 | 1 |

## Plan d'action

### 🔴 Priorité haute

- [ ] **Le contrôle « le produit existe et il est disponible » est écrit deux fois** — `model.js:85-92` (`validateOrderLine`) et `model.js:162-168` (`addSuggestedIds`) · G5
  - **Problème :** les deux fonctions cherchent le produit avec `menu.find((item) => item.id === …)` (lignes 126 et 162), puis vérifient qu'il existe et qu'il est disponible.
  - **Règle :** DRY : chaque connaissance doit exister à un seul endroit.
  - **Pourquoi :** si la règle change (par exemple « un produit en rupture peut quand même être conseillé »), il faut penser à la modifier à deux endroits, avec le risque que la commande et le conseil ne soient plus d'accord.
  - **Piste :** *Extraire jusqu'à épuisement* : une seule fonction qui, à partir d'un id, renvoie le produit s'il est commandable. Les deux handlers l'utilisent ; `validateOrderLine` n'a plus besoin de recevoir `product` en paramètre.

- [ ] **`validateOrderLine` répond à une question et modifie un tableau** — `model.js:84-102`, `validateOrderLine` · F2
  - **Problème :** la fonction renvoie `true` ou `false` **et** ajoute un message dans le tableau `errors` reçu en paramètre (argument de sortie). Pour savoir qu'elle modifie `errors`, il faut la lire en entier. Résultat : le handler doit gérer un booléen (`isValidLine`) **et** un tableau rempli ailleurs.
  - **Règle :** séparation commande/question ; pas d'argument de sortie.
  - **Pourquoi :** c'est exactement ce qui a provoqué le bug du passage précédent (`errors` hors de portée, `return` sans effet). Une fonction qui ne fait que répondre ne peut pas avoir ce genre d'effet surprise.
  - **Piste :** fais-lui **renvoyer** la raison du refus (ou rien si la ligne est bonne), sans toucher à `errors`. C'est le `forEach` qui décide d'ajouter le message ou le produit. Le booléen `isValidLine` et le troisième argument disparaissent. Profites-en pour mettre le nom ou l'id du produit dans chaque message (« Quantité invalide » ne dit pas pour quel produit).

- [ ] **Le message d'erreur de l'IA est écrit deux fois, et traité différemment** — `model.js:138-139` et `model.js:195-196` · G5
  - **Problème :** le texte « L'IA ne répond pas : prends la commande à la main » est recopié dans les deux `catch`. Seule la commande ajoute la classe `is-error` (ligne 137) ; le conseil non.
  - **Règle :** DRY ; un seul comportement pour un même cas.
  - **Pourquoi :** le serveur peut tomber pendant un conseil, et le message s'affiche alors sans le style d'erreur.
  - **Piste :** *Remplacer les nombres magiques par des constantes nommées* (ça marche aussi pour les chaînes), et une petite fonction « afficher une erreur de l'IA dans ce message » utilisée par les deux `catch`.

- [ ] **Le `try` de la commande entoure encore la validation** — `model.js:117-141`, `handleSubmitOrderForm` · G4
  - **Problème :** le `try` contient l'appel à l'IA **et** tout le traitement de la réponse (prénom, validation, ajout au ticket). Une erreur dans ton propre code s'affiche comme « L'IA ne répond pas ».
  - **Règle :** isoler le traitement des erreurs ; ne pas masquer les erreurs.
  - **Pourquoi :** tu l'as vécu au passage précédent : le bug de `errors` était caché derrière ce message.
  - **Piste :** fais comme dans le conseil : extrais « appliquer la réponse de Qwen à la commande » dans sa propre fonction, appelée après l'appel à l'IA, et laisse le `try` autour du strict nécessaire.

### 🟠 Priorité moyenne

- [ ] **Les tableaux de messages sont encore globaux** — `model.js:8-9`, `model.js:72-75`, `model.js:107`, `model.js:175` · G31
  - **Problème :** `orderMessages` et `adviceMessages` vivent tout le temps du programme alors qu'ils ne servent que le temps d'une requête. `addMessages` les remplit (argument de sortie), et `resetOrderForm` / `resetAdviceForm` doivent penser à les vider.
  - **Règle :** pas d'argument de sortie ; variable déclarée au plus près de son utilisation ; pas de couplage temporel caché.
  - **Pourquoi :** si une remise à zéro est oubliée, Qwen reçoit l'ancienne conversation avec la nouvelle. C'est ce qui serait arrivé avec le bug de `resetOrderForm`.
  - **Piste :** `addMessages` peut **construire et renvoyer** un nouveau tableau au lieu d'en remplir un. Le résultat part directement dans `askModel`. Les deux `let`, les deux lignes de remise à zéro et le premier argument disparaissent. Renomme-la alors pour qu'elle dise qu'elle *construit* une conversation.

- [ ] **`askModel` lit le corps avant de vérifier le statut** — `model.js:63-67`, `askModel` · G3
  - **Problème :** `response.json()` est appelé avant `if (!response.ok)`. Si Ollama renvoie une erreur qui n'est pas du JSON, c'est une erreur de lecture JSON qui part. `new Error(responseBody.error)` ne dit pas que l'erreur vient d'Ollama.
  - **Règle :** vérifier les cas limites ; message d'erreur avec contexte.
  - **Pourquoi :** les pannes les plus probables (Ollama éteint, modèle absent) donnent des messages trompeurs dans la console.
  - **Piste :** le statut d'abord, la lecture ensuite ; précise dans le message de l'erreur que c'est l'appel à Ollama qui a échoué. *Envelopper les API externes* : `askModel` est la bonne enveloppe, garde-la seule à connaître le format d'Ollama.

- [ ] **Les erreurs sont affichées en collant un tableau dans du texte** — `model.js:135`, `handleSubmitOrderForm` · G2
  - **Problème :** `aiOrderMessage.textContent = errors` laisse JavaScript transformer le tableau en texte séparé par des virgules, sans espace.
  - **Règle :** pas de comportement évident non implémenté ; ne pas compter sur une conversion implicite.
  - **Piste :** décide explicitement comment une liste d'erreurs devient une phrase.

- [ ] **Nombres et réglages magiques** — `model.js:56`, `model.js:95`, `model.js:161` · G25, G35
  - **Problème :** `"qwen3.5:4b"` est enfoui dans `askModel` ; les bornes `1` et `10` et le `2` du `slice(0, 2)` n'ont pas de nom. Le « au plus deux » est aussi écrit en toutes lettres dans le prompt (ligne 16), sans lien avec le code.
  - **Règle :** pas de nombre magique ; configuration à un seul endroit.
  - **Piste :** *Remplacer les nombres magiques par des constantes nommées*, en haut avec `OLLAMA_URL`, et utiliser la même constante dans le prompt.

- [ ] **Condition de quantité difficile à lire** — `model.js:93-97`, `validateOrderLine` · G28
  - **Problème :** trois tests et une négation sur cinq lignes.
  - **Piste :** *Exprimer l'intention dans le code* : une fonction dont le nom se lit comme une question sur la quantité.

- [ ] **`model.js` modifie la commande de l'extérieur** — `model.js:121-123`, `model.js:131-133` · G14
  - **Problème :** le prénom est écrit directement dans `order.customer`, et la quantité est ajoutée avec une boucle sur `order.add`.
  - **Règle :** *Dis, ne demande pas*.
  - **Piste :** isole « ajouter ce produit N fois » dans une fonction à toi pour que le handler dise *quoi* et non *comment*. Plus tard, *Déplacer la méthode* vers `order`.

- [ ] **La catégorie active est cherchée dans toute la page** — `model.js:180`, `handleSubmitAdviceForm` · G17
  - **Problème :** `document.querySelector(".is-active")` renvoie le premier élément de la page qui a cette classe, pas forcément un bouton de catégorie. Et `suggestedIds` (ligne 179) est une variable d'un autre fichier, réécrite d'ici.
  - **Piste :** cherche au moins le bouton actif **dans** la barre des catégories. `clearSuggestions` fait aussi double emploi avec `renderMenu`, qui redessine déjà la carte : garde un seul mécanisme.

### 🟢 Priorité basse

- [ ] **Marqueurs de position** — `model.js:49`, `model.js:70`, `model.js:146` · C
  - **Problème :** les lignes `// =====` découpent le fichier en sections.
  - **Pourquoi :** c'est le signe que le fichier contient plusieurs choses qui mériteraient chacune leur fichier.
  - **Piste :** *Supprimer le code mort* ; des lignes vides suffisent, ou un fichier par partie.

- [ ] **Ordre et espacement** — `model.js:148-152`, `model.js:171-177`
  - **Problème :** il manque une ligne vide avant `resetAdviceForm` et avant `handleSubmitAdviceForm`. Le `addEventListener` du conseil (ligne 149) est au milieu des `querySelector`, alors que celui de la commande est après.
  - **Piste :** même ordre pour les deux blocs (éléments du DOM, fonctions, écouteurs), une ligne vide entre chaque fonction.

- [ ] **Duplication de la transformation de la carte** — `model.js:3-6` · G5
  - **Problème :** `({ id: item.id, name: item.name })` est écrit deux fois.
  - **Piste :** une petite fonction nommée, utilisée par les deux constantes.

- [ ] **Ligne trop longue** — `model.js:16`, `adviceSystemPrompt`
  - **Problème :** plus de 400 caractères sur une ligne.
  - **Piste :** des retours à la ligne dans le template literal, comme pour `orderSystemPrompt`.

- [ ] **Clé `lines` pour une liste d'ids** — `model.js:21`, `adviceAnswerFormat` · N4
  - **Problème :** dans le conseil, `lines` contient des ids de produit, pas des lignes de commande.
  - **Piste :** *Renommer pour révéler l'intention*. Attention : c'est le format que Qwen renvoie, il faut renommer la clé dans le schéma **et** partout où elle est lue (`addSuggestedIds`), puis vérifier dans le navigateur.

## Architecture et structure des dossiers

Rien n'a changé depuis le 1ᵉʳ passage : `model.js` est toujours à la racine et contient quatre responsabilités (parler à Ollama, décrire les questions posées à l'IA, valider ses réponses, gérer deux formulaires). Les marqueurs `// =====` montrent d'ailleurs que tu sens déjà ce découpage.

L'organisation conseillée reste la même : un dossier pour l'IA du comptoir, rangé comme `register/`, avec un fichier par responsabilité (l'enveloppe Ollama, la prise de commande, le conseil, les formulaires). Vu que c'est un exercice, c'est le chantier le moins rentable : à garder pour un vrai projet.

## Points positifs

- **Les noms se lisent comme une phrase** : `orderAnswer`, `customerWish`, `activeCategoryButton`, `clearSuggestions`, `resetAdviceForm`. Plus besoin de remonter le code pour savoir ce que contient une variable.
- **`handleSubmitAdviceForm` est le modèle à suivre** : 24 lignes, des étapes nommées, un `try` limité à l'appel à l'IA.
- **Les schémas JSON sont des constantes** à côté des prompts : tout ce qui décrit la « question » posée à Qwen est au même endroit.
- **`askModel` reste la seule porte vers Ollama.**
- **La validation est sortie du handler** et protège bien le ticket (produit inconnu, indisponible, quantité hors limites).
- **Plus aucun code de débogage.**
- Tu as su **repérer et corriger un bug que ton refactoring avait introduit** : c'est la raison d'avancer par petites étapes.

## Notions à revoir

- **Abstraction (niveau d')** — Degré de détail d'une instruction. « Calculer le total de la commande » est de haut niveau ; « additionner les prix dans une boucle » est de bas niveau. Une fonction ne devrait pas mélanger les deux.
- **Affinage successif** (*successive refinement*) — Améliorer le code par petites étapes, en vérifiant après chacune que tout fonctionne encore.
- **Argument de sortie** (F2) — Paramètre qu'une fonction modifie au lieu de renvoyer son résultat. Le lecteur ne voit pas, en lisant l'appel, que la valeur passée va changer.
- **Complexité cognitive** — Mesure de la difficulté à lire une fonction ; elle augmente avec les conditions et surtout avec l'imbrication.
- **Complexité cyclomatique** — Nombre de chemins différents que peut prendre l'exécution d'une fonction. Plus il est grand, plus la fonction est difficile à suivre.
- **Définition de « terminé »** (*Definition of done*) — Un code est terminé quand il marche **et** qu'il est propre.
- **Dis, ne demande pas** (*Tell, don't ask*) — Demander à un objet de faire une action plutôt que lui demander ses données pour décider à sa place.
- **DRY** (*Don't Repeat Yourself*) — Ne pas se répéter : chaque connaissance doit exister à un seul endroit du code.
- **Effet de bord** (*side effect*) — Modification faite par une fonction en dehors de ce qu'elle renvoie : variable globale, fichier, paramètre modifié…
- **Indice de maintenabilité** — Note de 0 à 100 qui combine la taille, la complexité et le volume du code ; plus elle est haute, plus le code est facile à faire évoluer.
- **Jalousie de fonctionnalité** (*Feature Envy*, G14) — Méthode qui utilise plus les données d'une autre classe que celles de sa propre classe.
- **Nombre magique** (*magic number*) — Valeur écrite directement dans le code sans explication (`86400` au lieu de `SECONDS_PER_DAY`).
- **Règle du boy-scout** (*Boy Scout Rule*) — Laisser le code un peu plus propre qu'on ne l'a trouvé, à chaque modification.
- **Séparation commande/question** (*Command Query Separation*) — Une fonction fait une action **ou** répond à une question, jamais les deux.
- **Smell** (« odeur » de code) — Symptôme visible dans le code qui signale un problème de conception plus profond. Codes utilisés ici : N4 (nom ambigu), F2 (argument de sortie), G2 (comportement évident non implémenté), G3 (cas limites), G4 (erreurs masquées), G5 (duplication), G14 (jalousie de fonctionnalité), G17 (code au mauvais endroit), G25 (nombre magique), G28 (condition à encapsuler), G31 (couplage temporel caché), G35 (configuration enfouie), C (commentaires).

## Comment avancer

Il reste surtout de la duplication et de l'état global : corrige d'abord les doublons (contrôle du produit, message d'erreur), puis transforme `validateOrderLine` en vraie question, puis sors les tableaux de messages. Une case à la fois, et après chacune, essaie dans le navigateur : une commande normale, un « Filtre V60 » (indisponible), « 50 espressos », deux commandes à la suite, un conseil. Applique la règle du boy-scout à chaque passage, et relance `/refactor model.js` pour un 3ᵉ rapport.
