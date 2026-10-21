# Rapport de refactoring — 3ᵉ passage

> Périmètre : `model.js` · Date : 21/10/2026 · Rapports précédents : [REFACTOR.md](REFACTOR.md), [REFACTOR-2.md](REFACTOR-2.md)
> Métriques : estimées à la main (aucun outil d'analyse installé dans le projet)

## Résumé

| Indicateur | Résultat | 2ᵉ passage | 1ᵉʳ passage | Appréciation |
|---|---|---|---|---|
| Note globale du code | **13,7 / 20** | 12,4 | 9,3 | Propre : il reste surtout des finitions et un petit bug d'affichage |
| Note de complexité | 20 / 20 | 20 | 20 | Aucune fonction au-dessus des seuils |
| Indice de maintenabilité | ≈ 60 / 100 (rang A) | ≈ 55 | ≈ 42 | Treize petites fonctions faciles à faire évoluer |
| Complexité cyclomatique | moyenne 2,0 · max 5 dans `getOrderLineError` (rang A) | 2,4 · max 6 | 5 · max 9 | Simple partout |
| Définition de « terminé » | Marche : oui pour la commande · Propre : presque | — | — | La logique de la commande a été vérifiée dans Node avec un faux DOM et un faux Ollama (produit indisponible, id inconnu, quantité 50, IA en panne, deux commandes à la suite). Le conseil garde un bug d'affichage (voir priorité haute) |

La prise de commande est maintenant **un bon exemple de code propre** : un handler de 22 lignes qui enchaîne des étapes nommées, un `try` limité à l'appel à l'IA, et des fonctions de vérification qui *répondent* sans rien modifier. Le conseil n'a pas encore reçu le même traitement. Les trois chantiers qui restent : **aligner le conseil sur la commande**, **sortir les tableaux de messages de l'état global**, **fiabiliser `askModel`**.

## Ce qui a changé depuis le 2ᵉ passage

- [x] Contrôle « le produit existe et il est disponible » écrit une seule fois (`findProduct`, `getProductError`), utilisé par la commande **et** le conseil.
- [x] `validateOrderLine` devenue `getOrderLineError` : elle **renvoie** la raison du refus au lieu de remplir un tableau reçu en paramètre (plus d'argument de sortie).
- [x] Le contrôle « indisponible » est revenu dans la commande.
- [x] Message « L'IA ne répond pas » écrit une seule fois (`constructErrorMsg`), et le conseil affiche maintenant le style d'erreur.
- [x] `try` de la commande limité à l'appel à l'IA ; le traitement de la réponse est sorti dans `applyOrderAnswer`, la remise à zéro est dans un `finally`.
- [x] Transformation de la carte écrite une seule fois (`menuForModel`).

## Détail de la note globale

| Catégorie | Note | 2ᵉ | 1ᵉʳ | Poids |
|---|---|---|---|---|
| Nommage | 16 / 20 | 16 | 11 | 22 % |
| Fonctions | 15 / 20 | 12 | 7 | 28 % |
| Lisibilité et mise en forme | 12 / 20 | 12 | 12 | 11 % |
| Commentaires, code mort et duplication | 15 / 20 | 12 | 9 | 11 % |
| Objets, gestion des erreurs et frontières | 12 / 20 | 11 | 10 | 11 % |
| Classes, architecture et structure des dossiers | 10 / 20 | 10 | 9 | 17 % |
| **Total pondéré** | **13,7 / 20** | **12,4** | **9,3** | |

Note de complexité : 20 − 0 (aucune complexité cyclomatique > 10, aucune complexité cognitive > 15, aucune imbrication > 3 niveaux) = 20.

## Métriques par fonction

Les fonctions fléchées passées à `map`, `filter`, `forEach` sont comptées dans la fonction qui les contient. Lignes = lignes de la fonction, lignes vides comprises.

| Fichier | Fonction | Lignes | Arguments | Complexité cyclomatique | Complexité cognitive |
|---|---|---|---|---|---|
| model.js | `askModel` | 18 | 2 | 2 | 1 |
| model.js | `addMessages` | 4 | 3 | 1 | 0 |
| model.js | `constructErrorMsg` | 4 | 1 | 1 | 0 |
| model.js | `findProduct` | 3 | 1 | 1 | 0 |
| model.js | `getProductError` | 8 | 1 | 3 | 2 |
| model.js | `getOrderLineError` | 13 | 2 | 5 | 3 |
| model.js | `applyOrderAnswer` | 18 | 1 | 4 | 5 |
| model.js | `resetOrderForm` | 5 | 0 | 1 | 0 |
| model.js | `handleSubmitOrderForm` | 22 | 1 | 2 | 1 |
| model.js | `clearSuggestions` | 5 | 0 | 1 | 0 |
| model.js | `addSuggestedIds` | 9 | 1 | 2 | 2 |
| model.js | `resetAdviceForm` | 5 | 0 | 1 | 0 |
| model.js | `handleSubmitAdviceForm` | 23 | 1 | 2 | 1 |

## Plan d'action

### 🔴 Priorité haute

- [ ] **Le conseil reste rouge après une panne de l'IA** — `model.js:209` et `model.js:191-213`, `handleSubmitAdviceForm` · G2
  - **Problème :** depuis que `constructErrorMsg` ajoute la classe `is-error` au message du conseil, plus rien ne la retire. La commande le fait (ligne 143), le conseil non. Après une seule panne d'Ollama, tous les conseils suivants s'affichent avec le style d'erreur, même quand tout va bien.
  - **Règle :** pas de comportement évident non implémenté ; un même cas traité de la même façon partout.
  - **Pourquoi :** le vendeur croit que le conseil est une erreur.
  - **Piste :** fais faire au conseil ce que fait la commande au début du handler. Mieux encore : le jour où tu as un « afficher une erreur », il te faut son opposé « effacer l'erreur », utilisé par les deux formulaires.

- [ ] **Le `try` du conseil entoure encore le traitement de la réponse** — `model.js:201-211`, `handleSubmitAdviceForm` · G4
  - **Problème :** le `try` contient l'appel à l'IA **et** `addSuggestedIds`, l'affichage de l'explication et `renderMenu`. Une erreur dans ton code (par exemple `activeCategoryButton` à `null`) s'affiche comme « L'IA ne répond pas ».
  - **Règle :** isoler le traitement des erreurs ; ne pas masquer les erreurs.
  - **Pourquoi :** c'est le piège qui a caché le bug de `errors` au 1ᵉʳ passage. Tu l'as corrigé pour la commande ; le conseil a toujours le même risque.
  - **Piste :** applique au conseil le même schéma que dans `handleSubmitOrderForm` : un `try` autour de `askModel` seul, la remise à zéro dans le `finally`, et un « appliquer la réponse du conseil » après. Les deux handlers auront alors la même forme, ce qui les rend faciles à comparer.

### 🟠 Priorité moyenne

- [ ] **Les tableaux de messages sont encore globaux** — `model.js:7-8`, `model.js:71-74`, `model.js:137`, `model.js:189` · F2, G31
  - **Problème :** `orderMessages` et `adviceMessages` vivent tout le temps du programme, `addMessages` les remplit (argument de sortie), et chaque `reset…Form` doit penser à les vider.
  - **Règle :** pas d'argument de sortie ; variable au plus près de son utilisation ; pas de couplage temporel caché.
  - **Pourquoi :** si un jour une remise à zéro saute (un `return` de plus, un nouveau formulaire), Qwen reçoit l'ancienne conversation avec la nouvelle, sans aucun message d'erreur.
  - **Piste :** `addMessages` peut **construire et renvoyer** une nouvelle conversation au lieu d'en remplir une. Son résultat part directement dans `askModel`. Les deux `let`, les deux lignes de remise à zéro et le premier argument disparaissent. Renomme-la pour qu'elle dise qu'elle *construit*.

- [ ] **`askModel` lit le corps avant de vérifier le statut** — `model.js:62-66`, `askModel` · G3
  - **Problème :** `response.json()` est appelé avant `if (!response.ok)`. Si Ollama renvoie une erreur qui n'est pas du JSON, c'est une erreur de lecture JSON qui part. `new Error(responseBody.error)` ne dit pas que l'erreur vient d'Ollama.
  - **Règle :** vérifier les cas limites ; message d'erreur avec contexte.
  - **Pourquoi :** les pannes les plus probables (Ollama éteint, modèle absent) donnent des messages trompeurs dans la console.
  - **Piste :** le statut d'abord, la lecture ensuite ; précise dans le message de l'erreur que c'est l'appel à Ollama qui a échoué. *Envelopper les API externes* : `askModel` est la bonne enveloppe, garde-la seule à connaître le format d'Ollama.

- [ ] **Les erreurs sont affichées en collant un tableau dans du texte** — `model.js:159`, `handleSubmitOrderForm` · G2
  - **Problème :** `aiOrderMessage.textContent = applyOrderAnswer(orderAnswer)` laisse JavaScript transformer le tableau d'erreurs en texte séparé par des virgules, sans espace.
  - **Règle :** ne pas compter sur une conversion implicite.
  - **Piste :** décide explicitement comment une liste d'erreurs devient une phrase, dans une petite fonction d'affichage.

- [ ] **`constructErrorMsg` porte un nom trompeur** — `model.js:76`, `constructErrorMsg` · N1
  - **Problème :** la fonction ne *construit* pas un message, elle *affiche* une erreur dans un élément. `Msg` est une abréviation, et `target` ne dit pas que c'est l'élément de message.
  - **Règle :** le nom dit ce que fait la fonction ; pas d'abréviation.
  - **Piste :** *Renommer pour révéler l'intention* : un verbe d'affichage et le mot « erreur » ou « panne de l'IA ».

- [ ] **Nombres et réglages magiques** — `model.js:55`, `model.js:107-108`, `model.js:178` · G25, G35
  - **Problème :** `"qwen3.5:4b"` est enfoui dans `askModel` ; les bornes `1` et `10` et le `2` du `slice(0, 2)` n'ont pas de nom. Le « au plus deux » est aussi écrit dans le prompt (ligne 15), sans lien avec le code.
  - **Piste :** *Remplacer les nombres magiques par des constantes nommées*, en haut avec `OLLAMA_URL`, et utiliser la même constante dans le prompt.

- [ ] **Condition de quantité difficile à lire** — `model.js:106-110`, `getOrderLineError` · G28
  - **Problème :** trois tests et une négation sur cinq lignes.
  - **Piste :** *Exprimer l'intention dans le code* : une fonction dont le nom se lit comme une question sur la quantité.

- [ ] **La catégorie active est cherchée dans toute la page** — `model.js:193-194`, `handleSubmitAdviceForm` · G17
  - **Problème :** `document.querySelector(".is-active")` renvoie le premier élément de la page qui a cette classe, pas forcément un bouton de catégorie. `suggestedIds` est une variable d'un autre fichier réécrite d'ici, et `clearSuggestions` fait double emploi avec `renderMenu`, qui redessine déjà la carte.
  - **Piste :** cherche le bouton actif **dans** la barre des catégories, et garde un seul mécanisme pour effacer les suggestions.

- [ ] **`model.js` modifie la commande de l'extérieur** — `model.js:117-119`, `model.js:127-129`, `applyOrderAnswer` · G14
  - **Problème :** le prénom est écrit directement dans `order.customer`, et la quantité est ajoutée avec une boucle sur `order.add`.
  - **Règle :** *Dis, ne demande pas*.
  - **Piste :** isole « ajouter ce produit N fois » dans une fonction nommée pour que `applyOrderAnswer` dise *quoi* et non *comment*. Plus tard, *Déplacer la méthode* vers `order`.

### 🟢 Priorité basse

- [ ] **Marqueurs de position** — `model.js:48`, `model.js:69`, `model.js:163` · C
  - **Problème :** les lignes `// =====` découpent le fichier en sections.
  - **Piste :** *Supprimer le code mort* ; des lignes vides suffisent, ou un fichier par partie.

- [ ] **Ordre et espacement** — `model.js:165-169`, `model.js:185-191`
  - **Problème :** il manque une ligne vide avant `resetAdviceForm` et avant `handleSubmitAdviceForm`. Le `addEventListener` du conseil (ligne 166) est au milieu des `querySelector`, alors que celui de la commande est après. Les fonctions communes (`findProduct`, `getProductError`, `constructErrorMsg`) sont rangées avant les éléments de la commande, mais `getOrderLineError` est après : la frontière entre « partagé » et « commande » n'est pas visible.
  - **Piste :** même ordre pour les deux blocs (éléments du DOM, fonctions, écouteurs) ; les fonctions partagées regroupées ensemble ; une ligne vide entre chaque fonction.

- [ ] **Ligne trop longue** — `model.js:15`, `adviceSystemPrompt`
  - **Problème :** plus de 400 caractères sur une ligne.
  - **Piste :** des retours à la ligne dans le template literal, comme pour `orderSystemPrompt`.

- [ ] **Clé `lines` pour une liste d'ids** — `model.js:20`, `adviceAnswerFormat` · N4
  - **Problème :** dans le conseil, `lines` contient des ids de produit, pas des lignes de commande.
  - **Piste :** *Renommer pour révéler l'intention*, dans le schéma **et** dans `addSuggestedIds`, puis vérifier dans le navigateur que Qwen suit le nouveau nom.

## Architecture et structure des dossiers

Pas de changement : `model.js` est toujours à la racine et contient quatre responsabilités (parler à Ollama, décrire les questions posées à l'IA, valider ses réponses, gérer deux formulaires). Le fichier fait maintenant 214 lignes, juste au-dessus du repère de 200 : c'est le bon moment pour le découper si tu continues. Le découpage est déjà visible dans ton code : l'enveloppe Ollama, les fonctions partagées sur les produits, la commande, le conseil. Sur un exercice, ce chantier reste le moins rentable.

## Points positifs

- **`handleSubmitOrderForm` est devenu exemplaire** : 22 lignes qui se lisent comme une recette (préparer l'interface, demander à Qwen, appliquer la réponse, redessiner le ticket). Le `finally` garantit la remise à zéro dans tous les cas.
- **Les fonctions de vérification répondent sans agir** : `getProductError` et `getOrderLineError` renvoient un message ou rien, et ne modifient aucun état. C'est la séparation commande/question appliquée.
- **Plus de duplication importante** : le contrôle du produit, le message de panne et la transformation de la carte n'existent plus qu'une fois.
- **La caisse a le dernier mot** : même si Qwen renvoie un produit indisponible ou une quantité absurde, rien ne passe sur le ticket.
- **Aucune fonction ne dépasse 23 lignes** (contre 67 au 1ᵉʳ passage), et la complexité maximale est passée de 9 à 5.
- **Les noms se lisent comme une phrase** : `findProduct`, `getProductError`, `applyOrderAnswer`, `customerWish`, `activeCategoryButton`.

## Notions à revoir

- **Affinage successif** (*successive refinement*) — Améliorer le code par petites étapes, en vérifiant après chacune que tout fonctionne encore.
- **Argument de sortie** (F2) — Paramètre qu'une fonction modifie au lieu de renvoyer son résultat. Le lecteur ne voit pas, en lisant l'appel, que la valeur passée va changer.
- **Complexité cognitive** — Mesure de la difficulté à lire une fonction ; elle augmente avec les conditions et surtout avec l'imbrication.
- **Complexité cyclomatique** — Nombre de chemins différents que peut prendre l'exécution d'une fonction. Plus il est grand, plus la fonction est difficile à suivre.
- **Définition de « terminé »** (*Definition of done*) — Un code est terminé quand il marche **et** qu'il est propre.
- **Dis, ne demande pas** (*Tell, don't ask*) — Demander à un objet de faire une action plutôt que lui demander ses données pour décider à sa place.
- **Indice de maintenabilité** — Note de 0 à 100 qui combine la taille, la complexité et le volume du code ; plus elle est haute, plus le code est facile à faire évoluer.
- **Jalousie de fonctionnalité** (*Feature Envy*, G14) — Méthode qui utilise plus les données d'une autre classe que celles de sa propre classe.
- **Nombre magique** (*magic number*) — Valeur écrite directement dans le code sans explication (`86400` au lieu de `SECONDS_PER_DAY`).
- **Règle du boy-scout** (*Boy Scout Rule*) — Laisser le code un peu plus propre qu'on ne l'a trouvé, à chaque modification.
- **Séparation commande/question** (*Command Query Separation*) — Une fonction fait une action **ou** répond à une question, jamais les deux.
- **Smell** (« odeur » de code) — Symptôme visible dans le code qui signale un problème de conception plus profond. Codes utilisés ici : N1 (nom peu parlant), N4 (nom ambigu), F2 (argument de sortie), G2 (comportement évident non implémenté), G3 (cas limites), G4 (erreurs masquées), G14 (jalousie de fonctionnalité), G17 (code au mauvais endroit), G25 (nombre magique), G28 (condition à encapsuler), G31 (couplage temporel caché), G35 (configuration enfouie), C (commentaires).

## Comment avancer

Commence par les deux priorités hautes : elles se règlent ensemble en donnant au conseil la même forme que la commande. Ensuite, les priorités moyennes une par une, en essayant après chacune dans le navigateur : une commande normale, un produit indisponible, « 50 espressos », deux commandes à la suite, un conseil, puis un conseil après avoir coupé Ollama. Tu es à 13,7 : les priorités hautes et moyennes faites, le fichier passerait autour de 16. Applique la règle du boy-scout à chaque passage, et relance `/refactor model.js` pour un 4ᵉ rapport.
