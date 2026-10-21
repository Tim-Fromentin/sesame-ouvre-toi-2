# Rapport de refactoring

> Périmètre : `model.js` (le reste du projet est fourni par l'exercice et n'est pas noté) · Date : 21/10/2026
> Métriques : estimées à la main (aucun outil d'analyse installé dans le projet)

## Résumé

| Indicateur | Résultat | Appréciation |
|---|---|---|
| Note globale du code | 9,3 / 20 | Niveau junior : l'idée est bonne, mais tout est entassé dans deux longues fonctions |
| Note de complexité | 20 / 20 | Aucune fonction ne dépasse les seuils de complexité ; c'est la *longueur* qui pose problème (voir « Fonctions ») |
| Indice de maintenabilité | ≈ 42 / 100 (rang A) | Correct, tiré vers le bas par `handleSubmitOrderForm` (≈ 37) |
| Complexité cyclomatique | moyenne 5 · max 9 dans `handleSubmitOrderForm` (rang A) | Simple en moyenne, un point chaud |
| Définition de « terminé » | Marche : oui en apparence · Propre : non | Le fichier se charge sans erreur de syntaxe et Ollama répond avec `qwen3.5:4b` ; certains cas d'erreur sont mal signalés (voir priorité haute) |

`model.js` a de bons réflexes : un seul endroit parle à Ollama (`askModel`), les prompts sont construits à partir de la carte, et la caisse vérifie ce que l'IA propose au lieu de lui faire confiance. En revanche, les deux handlers font chacun tout le travail (interface, appel à l'IA, règles métier, affichage) et sont presque des copies l'un de l'autre. Les trois chantiers prioritaires : **découper les deux handlers**, **supprimer la duplication entre eux**, **fiabiliser la gestion des erreurs**.

## Détail de la note globale

| Catégorie | Note | Poids |
|---|---|---|
| Nommage | 11 / 20 | 22 % |
| Fonctions | 7 / 20 | 28 % |
| Lisibilité et mise en forme | 12 / 20 | 11 % |
| Commentaires, code mort et duplication | 9 / 20 | 11 % |
| Objets, gestion des erreurs et frontières | 10 / 20 | 11 % |
| Classes, architecture et structure des dossiers | 9 / 20 | 17 % |
| **Total pondéré** | **9,3 / 20** | |

Les poids du barème ont été répartis à nouveau sur ces six catégories.

Note de complexité : 20 − 0 (aucune complexité cyclomatique > 10, aucune complexité cognitive > 15, aucune imbrication > 3 niveaux) = 20.

## Métriques par fonction

Les fonctions fléchées passées à `map`, `filter`, `forEach` sont comptées dans la fonction qui les contient. Lignes = lignes de la fonction, lignes vides comprises.

| Fichier | Fonction | Lignes | Arguments | Complexité cyclomatique | Complexité cognitive |
|---|---|---|---|---|---|
| model.js | `askModel` | 18 | 2 | 2 | 1 |
| model.js | `handleSubmitOrderForm` | **67** | 1 | **9** | **11** |
| model.js | `handleSubmitAdviceForm` | **46** | 1 | 4 | 5 |

Détail du calcul pour `handleSubmitOrderForm` : 1 + `if (response.customer)` + `if (!product)` + `if (!product.available)` + `if` de quantité + deux `||` + `for` + `catch` = 9.

## Plan d'action

### 🔴 Priorité haute

- [ ] **`handleSubmitOrderForm` fait au moins cinq choses** — `model.js:43-109`, `handleSubmitOrderForm` · G30, G6
  - **Problème :** 67 lignes qui, à la suite : préparent l'interface (bouton, message d'attente), construisent les messages pour Qwen, décrivent le schéma JSON attendu (lignes 54-69), appliquent le prénom, valident chaque ligne (produit, disponibilité, quantité), remplissent la commande, affichent les erreurs, gèrent l'échec, puis remettent l'interface à zéro.
  - **Règle :** une fonction fait une seule chose, à un seul niveau d'abstraction ; au-delà de 40 lignes, c'est une priorité haute.
  - **Pourquoi :** pour comprendre la règle « qu'est-ce qu'une ligne valide ? », il faut lire aussi du DOM et de l'appel réseau.
  - **Piste :** *Extraire jusqu'à épuisement*. Tes étapes sont déjà visibles dans le code : donne à chacune une fonction nommée d'après ce qu'elle fait. Par exemple : une pour demander la commande à Qwen, une qui vérifie **une** ligne et dit pourquoi elle est refusée, une qui ajoute une ligne validée au ticket, une qui affiche le résultat. À la fin, le handler ne contient plus que l'enchaînement de ces appels. Range ensuite les fonctions selon la *règle de la descente*.

- [ ] **`handleSubmitAdviceForm` mélange aussi tous les niveaux** — `model.js:117-162`, `handleSubmitAdviceForm` · G30, G6
  - **Problème :** 46 lignes qui vont chercher la catégorie active dans le DOM, retirent à la main les classes `is-suggested`, appellent Qwen avec le schéma écrit sur place, filtrent les ids, puis redessinent la carte.
  - **Règle :** une seule chose par fonction (G30), un seul niveau d'abstraction (G6).
  - **Pourquoi :** même problème que ci-dessus. En plus, les lignes 120-122 retirent les classes à la main alors que `renderMenu` (ligne 153) redessine déjà toute la carte à partir de `suggestedIds` : deux mécanismes pour le même effet, et le lecteur doit comprendre les deux.
  - **Piste :** *Extraire jusqu'à épuisement* : une fonction « demander un conseil », une fonction « garder les ids conseillés qui sont valides », une fonction « afficher le conseil ». Pour l'affichage, garde **un seul** mécanisme : vider `suggestedIds` puis laisser `renderMenu` redessiner.

- [ ] **Les deux handlers sont deux copies du même squelette** — `model.js:43-109` et `model.js:117-162` · G5
  - **Problème :**
    - Les deux fonctions répètent la même séquence : désactiver le bouton, pousser un message `system` puis un message `user` dans un tableau global, appeler `askModel`, attraper l'erreur avec **le même texte** (« L'IA ne répond pas : prends la commande à la main », lignes 100 et 156), réactiver le bouton, vider le champ, vider le tableau.
    - Les lignes 3 à 6 écrivent deux fois la même transformation `({ id: item.id, name: item.name })`.
    - La recherche `menu.find((item) => item.id === …)` apparaît lignes 76 et 143, suivie les deux fois du même contrôle « le produit existe et il est disponible ».
  - **Règle :** DRY : chaque connaissance doit exister à un seul endroit.
  - **Pourquoi :** si tu ajoutes une troisième fonction IA, ou si tu changes le message d'erreur, il faudra penser à modifier chaque copie. C'est la **cause racine** de la longueur des deux handlers : corriger la duplication règle déjà une bonne partie des deux actions précédentes.
  - **Piste :** *Extraire jusqu'à épuisement* sur ce qui est commun : une fonction qui pose une question à Qwen à partir d'un prompt système et de la phrase du client (elle construit elle-même le tableau de messages), une fonction qui transforme une liste de produits en version « pour le modèle », une fonction qui retrouve un produit commandable par son id. Le message d'erreur devient une constante (*Remplacer les nombres magiques par des constantes nommées*, qui marche aussi pour les chaînes).

- [ ] **Le `catch` transforme tous les bugs en « L'IA ne répond pas »** — `model.js:98-103` et `model.js:154-158` · G4
  - **Problème :** le `try` entoure tout le handler. Une faute de frappe dans ton code, un `response.lines` absent, un `activeCategorie` à `null` ou un JSON mal formé renvoyé par Qwen affichent tous « L'IA ne répond pas », ce qui est faux dans la plupart de ces cas. Dans le conseil, le message d'erreur n'a même pas la classe `is-error`, alors que la commande l'ajoute (ligne 101).
  - **Règle :** ne pas masquer les erreurs ; isoler le traitement des erreurs ; un message d'erreur donne du contexte.
  - **Pourquoi :** le jour où un vrai bug apparaît, l'écran t'envoie vérifier Ollama au lieu de ton code.
  - **Piste :** *Isoler le traitement des erreurs* : le `try` ne devrait entourer que l'appel à l'IA. Fais en sorte que `askModel` lève des erreurs qui disent **ce qui** a échoué (serveur injoignable, serveur qui répond une erreur, réponse qui n'est pas du JSON valide), pour pouvoir afficher le bon message. Traite les deux formulaires de la même façon pour l'état d'erreur.

- [ ] **`askModel` lit le corps avant de vérifier le statut** — `model.js:30-34`, `askModel` · G3
  - **Problème :** `response.json()` est appelé avant `if (!response.ok)`. Si Ollama renvoie une erreur qui n'est pas du JSON, c'est une erreur de lecture JSON qui part, pas `data.error`. `new Error(data.error)` n'indique pas que l'erreur vient d'Ollama. Enfin, `JSON.parse(data.message.content)` fait confiance à la forme de la réponse sans la vérifier.
  - **Règle :** vérifier les cas limites (G3) ; message d'erreur avec contexte.
  - **Pourquoi :** les erreurs les plus probables (Ollama éteint, modèle absent) donnent des messages trompeurs dans la console.
  - **Piste :** réordonne les étapes : le statut d'abord, la lecture ensuite. Précise dans chaque erreur levée l'opération qui a échoué. *Envelopper les API externes* : `askModel` est déjà une bonne enveloppe, garde-la comme **seul** endroit qui connaît le format des réponses d'Ollama.

### 🟠 Priorité moyenne

- [ ] **Un identifiant en français et plusieurs noms trompeurs** — `model.js` · N1, N4
  - **Problème :**
    - `activeCategorie` (ligne 119) : identifiant en français, et c'est un **bouton**, pas une catégorie.
    - `message` et `messageAdvice` (lignes 8-9) : des tableaux au singulier, avec deux ordres de mots différents. `messageAdvice` ressemble beaucoup à `aiAdviceMessage` (ligne 114), qui est l'élément du DOM : confusion directe.
    - `errorMsg` (ligne 47) : abréviation, et c'est une liste.
    - `response` (lignes 53 et 129) : même nom que la réponse HTTP dans `askModel`, alors que c'est la réponse déjà décodée de Qwen.
    - `line` (ligne 142) : dans le conseil, c'est un **id de produit**, pas une ligne de commande ; la propriété `lines` du schéma du conseil (ligne 132) a le même problème.
    - `value` (lignes 48 et 124) : ne dit pas que c'est la phrase du client.
    - `e` (lignes 43, 98, 117, 154) : le `e` du `catch` cache le `e` de l'événement.
    - `aiOrderBtn` / `aiAdviceBtn` : abréviation, alors que le reste du projet écrit `checkoutButton`, `removeButton`.
  - **Règle :** identifiants en anglais ; le nom révèle l'intention ; pas de désinformation ; un mot par concept.
  - **Pourquoi :** chaque nom trompeur oblige le lecteur à remonter le code pour savoir ce que contient vraiment la variable.
  - **Piste :** *Renommer pour révéler l'intention* (F2 dans VS Code). Pour chacune, pose-toi la question « que contient-elle vraiment ? » et prends la réponse comme nom.

- [ ] **Nombres et réglages magiques** — `model.js:23`, `model.js:86-88`, `model.js:142` · G25, G35
  - **Problème :** le nom du modèle `"qwen3.5:4b"` est enfoui au milieu de `askModel`, alors que l'URL est déjà une constante en ligne 1. Les bornes `1` et `10` de la quantité et le `2` du `slice(0, 2)` n'ont pas de nom.
  - **Règle :** pas de nombre magique ; la configuration à un seul endroit, en haut du fichier.
  - **Pourquoi :** pour changer de modèle ou de limite, il faut fouiller le code. Et la règle « au plus deux conseils » est écrite à la fois dans le prompt (ligne 16) et dans le code, sans lien entre les deux : si tu en changes un, l'autre devient faux.
  - **Piste :** *Remplacer les nombres magiques par des constantes nommées*, regroupées avec `OLLAMA_URL`. Utilise la même constante dans le texte du prompt et dans le `slice`.

- [ ] **Condition de quantité difficile à lire** — `model.js:85-89`, `handleSubmitOrderForm` · G28
  - **Problème :** la condition sur trois lignes mélange deux bornes et une vérification de type, avec une négation.
  - **Règle :** extraire une condition complexe dans une fonction au nom explicite.
  - **Pourquoi :** il faut la décoder pour comprendre qu'elle veut dire « la quantité est invalide ». Les messages d'erreur ne disent pas non plus **quel** produit pose problème (« Quantité invalide », « Produit introuvable »).
  - **Piste :** *Exprimer l'intention dans le code* : une fonction dont le nom se lit comme une question sur la quantité. Profites-en pour mettre le nom ou l'id du produit dans chaque message.

- [ ] **Les erreurs sont affichées en collant un tableau dans du texte** — `model.js:97`, `handleSubmitOrderForm` · G2
  - **Problème :** `aiOrderMessage.textContent = errorMsg` met un tableau dans `textContent`. JavaScript le convertit tout seul en texte séparé par des virgules, sans espace (« Produit Filtre V60 indisponible,Quantité invalide »).
  - **Règle :** pas de comportement évident non implémenté ; ne pas compter sur une conversion implicite.
  - **Pourquoi :** le rendu est peu lisible, et il dépend d'un détail du langage que le lecteur doit connaître pour comprendre ce qui s'affiche.
  - **Piste :** décide explicitement comment une liste d'erreurs devient un texte, dans une petite fonction d'affichage.

- [ ] **État global et DOM utilisés comme mémoire** — `model.js:8-9`, `model.js:119`, `model.js:123` · G17, G31
  - **Problème :**
    - `message` et `messageAdvice` sont globaux alors qu'ils ne servent que le temps d'une requête : ils sont remplis, puis vidés à la main lignes 108 et 161.
    - `suggestedIds = []` (ligne 123) réécrit une variable déclarée dans un autre fichier (`register/menu-section.js`) : rien dans `model.js` ne dit d'où elle vient.
    - La catégorie affichée est retrouvée avec `document.querySelector(".is-active")`, qui prend le **premier** élément de toute la page portant cette classe, pas forcément un bouton de catégorie.
  - **Règle :** pas d'effet de bord caché ; une variable est déclarée au plus près de son utilisation ; pas de couplage temporel caché.
  - **Pourquoi :** si tu oublies une remise à zéro, l'ancienne conversation est renvoyée à Qwen avec la nouvelle. Si un autre élément reçoit un jour la classe `is-active`, le conseil redessine la mauvaise catégorie.
  - **Piste :** les tableaux de messages deviennent des variables locales construites à chaque appel (ce que fera la fonction commune de l'action DRY), et les remises à zéro disparaissent. Pour la catégorie, cherche au moins le bouton actif **dans** la barre des catégories plutôt que dans toute la page.

- [ ] **`model.js` modifie la commande de l'extérieur** — `model.js:73`, `model.js:93-95`, `handleSubmitOrderForm` · G14
  - **Problème :** le prénom est écrit directement dans `order.customer`, et la quantité est ajoutée en appelant `order.add` dans une boucle `for`.
  - **Règle :** *Dis, ne demande pas* ; jalousie de fonctionnalité.
  - **Pourquoi :** la boucle est un détail de bas niveau au milieu d'un handler de haut niveau, et si `order` change sa façon de stocker les quantités, `model.js` devra changer aussi.
  - **Piste :** en attendant de pouvoir toucher `register/order.js`, isole au moins « ajouter ce produit N fois » dans une fonction à toi, pour que le handler dise *quoi* et non *comment*. Plus tard, *Déplacer la méthode* : c'est à `order` de savoir ajouter un produit en plusieurs exemplaires.

- [ ] **Un fichier, quatre responsabilités, un nom trompeur** — `model.js` · SRP, G17
  - **Problème :** le fichier parle à Ollama, contient les prompts et les schémas, applique les règles métier de la caisse, et gère deux formulaires. Son nom « model » se lit comme le *modèle de données* (au sens MVC), alors qu'il contient l'IA du comptoir.
  - **Règle :** responsabilité unique ; code au bon endroit.
  - **Pourquoi :** changer de serveur d'IA, ajuster un prompt, changer une règle de quantité ou modifier un formulaire : quatre raisons différentes de modifier le même fichier.
  - **Piste :** voir la section Architecture.

### 🟢 Priorité basse

- [ ] **`console.log` de débogage oublié** — `model.js:140`, `handleSubmitAdviceForm` · G12
  - **Problème :** `console.log(response);` est resté dans le code.
  - **Règle :** pas de code de débogage dans le code final.
  - **Pourquoi :** il pollue la console à chaque conseil.
  - **Piste :** *Supprimer le code mort*.

- [ ] **Ordre de lecture du fichier** — `model.js:37-42`, `model.js:111-115`
  - **Problème :** pour la commande, l'abonnement à l'événement est placé juste avant la fonction (ligne 42) ; pour le conseil, il est au milieu des `querySelector` (ligne 112). Les sélections du DOM sont éparpillées entre les fonctions.
  - **Règle :** métaphore du journal ; une seule convention dans le fichier.
  - **Pourquoi :** les deux blocs se ressemblent mais ne sont pas rangés pareil, ce qui oblige à chercher.
  - **Piste :** choisis un ordre (constantes, éléments du DOM, fonctions, puis branchement des écouteurs à la fin) et applique-le aux deux blocs.

- [ ] **Ligne trop longue** — `model.js:16`, `advicePrompt`
  - **Problème :** le prompt du conseil tient sur une seule ligne de plus de 400 caractères.
  - **Règle :** largeur des lignes sous 120 caractères.
  - **Pourquoi :** illisible sans défilement horizontal, et difficile à relire dans un diff Git.
  - **Piste :** un template literal accepte les retours à la ligne, comme tu l'as déjà fait pour `orderPrompt`.

- [ ] **Pas de formateur automatique** — `model.js` · G24
  - **Problème :** aucun formateur n'est configuré dans le projet. Ton fichier est bien formaté, mais rien ne garantit qu'il le reste.
  - **Règle :** un seul style d'équipe, automatisé.
  - **Piste :** ajoute une configuration Prettier au projet pour que le formatage ne dépende plus de l'éditeur.

## Architecture et structure des dossiers

```
sesame-ouvre-toi-2/
├── menu.js             la carte (fourni)
├── register/           la caisse (fournie)
├── script.js           démarrage + plan des étapes (fourni)
└── model.js            ← ton code : client Ollama, prompts, validation, formulaires
```

**Ce qui va bien :** `model.js` est séparé de la caisse fournie, et tu t'appuies sur ce qu'elle expose (`order.add`, `renderMenu`, `renderTicket`) plutôt que de la réécrire. `askModel` isole déjà l'appel réseau.

**Ce qui ne va pas :** `model.js` cumule quatre responsabilités qui n'ont pas la même raison de changer :
1. parler à Ollama (URL, nom du modèle, `askModel`) ;
2. décrire ce qu'on demande à l'IA (prompts, schémas JSON) ;
3. valider ce que l'IA propose (règles métier de la caisse) ;
4. relier tout ça aux deux formulaires (DOM).

Il est aussi à la racine, alors que le reste du code applicatif est rangé par fonctionnalité dans `register/`. Et `script.js` annonce « L'IA du comptoir. Ton code, une section par étape », mais ton code est ailleurs : un lecteur qui suit ce commentaire ne le trouve pas.

**Organisation conseillée :** un dossier pour l'IA du comptoir, rangé comme `register/` (par fonctionnalité), avec un nom qui dit ce qu'il contient. Dedans, un fichier par responsabilité : l'enveloppe autour d'Ollama, la prise de commande (prompt, schéma, validation des lignes), le conseil (prompt, schéma, filtrage des ids), et les formulaires qui relient le tout au DOM. Pense à mettre à jour les balises `<script>` de `index.html` dans le bon ordre.

## Points positifs

- **`askModel` est une enveloppe autour de l'API externe** : un seul endroit fait le `fetch`, les handlers ne connaissent ni l'URL ni le format de la requête. C'est la bonne idée à garder.
- **`OLLAMA_URL`** est une constante nommée, en haut du fichier.
- **La caisse vérifie ce que l'IA propose** (produit existant, disponible, quantité raisonnable, au plus deux conseils) au lieu de lui faire confiance. C'est exactement le bon réflexe avec un modèle de langage.
- **Les prompts sont construits à partir de la carte** (`menuForModel`) au lieu d'être recopiés à la main : si la carte change, les prompts suivent. Et l'IA de conseil ne voit que les produits disponibles.
- **Le format JSON imposé** à Qwen (`format`) rend la réponse exploitable sans analyse de texte fragile.
- **Le bouton est désactivé pendant l'appel**, ce qui évite les doubles envois.
- **`textContent` partout**, jamais `innerHTML` : le texte venant de l'IA ne peut pas injecter de HTML.
- **Pas de commentaire inutile** : le code ne se justifie pas par des commentaires, il reste à le rendre assez clair pour s'en passer.

## Notions à revoir

- **Abstraction (niveau d')** — Degré de détail d'une instruction. « Calculer le total de la commande » est de haut niveau ; « additionner les prix dans une boucle » est de bas niveau. Une fonction ne devrait pas mélanger les deux.
- **Adaptateur** (*Adapter*) — Classe qui fait le lien entre l'interface qu'on voudrait utiliser et celle que fournit une bibliothèque. Si la bibliothèque change, seul l'adaptateur change.
- **Affinage successif** (*successive refinement*) — Améliorer le code par petites étapes, en vérifiant après chacune que tout fonctionne encore.
- **Complexité cognitive** — Mesure de la difficulté à lire une fonction ; elle augmente avec les conditions et surtout avec l'imbrication.
- **Complexité cyclomatique** — Nombre de chemins différents que peut prendre l'exécution d'une fonction. Plus il est grand, plus la fonction est difficile à suivre.
- **Définition de « terminé »** (*Definition of done*) — Un code est terminé quand il marche **et** qu'il est propre.
- **Dis, ne demande pas** (*Tell, don't ask*) — Demander à un objet de faire une action plutôt que lui demander ses données pour décider à sa place.
- **DRY** (*Don't Repeat Yourself*) — Ne pas se répéter : chaque connaissance doit exister à un seul endroit du code.
- **Effet de bord** (*side effect*) — Modification faite par une fonction en dehors de ce qu'elle renvoie : variable globale, fichier, paramètre modifié…
- **Indice de maintenabilité** — Note de 0 à 100 qui combine la taille, la complexité et le volume du code ; plus elle est haute, plus le code est facile à faire évoluer.
- **Jalousie de fonctionnalité** (*Feature Envy*, G14) — Méthode qui utilise plus les données d'une autre classe que celles de sa propre classe.
- **Métaphore du journal** (*Newspaper Metaphor*) — Un fichier se lit comme un article : le titre et l'essentiel en haut, les détails en dessous.
- **Nombre magique** (*magic number*) — Valeur écrite directement dans le code sans explication (`86400` au lieu de `SECONDS_PER_DAY`).
- **Règle de la descente** (*Stepdown Rule*) — Chaque fonction est suivie des fonctions qu'elle appelle, un niveau d'abstraction plus bas ; le fichier se lit de haut en bas.
- **Règle du boy-scout** (*Boy Scout Rule*) — Laisser le code un peu plus propre qu'on ne l'a trouvé, à chaque modification.
- **Smell** (« odeur » de code) — Symptôme visible dans le code qui signale un problème de conception plus profond. Codes utilisés ici : N1 (nom peu parlant), N4 (nom ambigu), G2 (comportement évident non implémenté), G3 (cas limites), G4 (erreurs masquées), G5 (duplication), G6 (mauvais niveau d'abstraction), G12 (désordre, code de débogage), G14 (jalousie de fonctionnalité), G17 (code au mauvais endroit), G24 (conventions), G25 (nombre magique), G28 (condition à encapsuler), G30 (fonction qui fait plusieurs choses), G31 (couplage temporel caché), G35 (configuration enfouie).
- **SRP** (*Single Responsibility Principle*) — Principe de responsabilité unique : une classe ou un module n'a qu'une seule raison de changer.

## Comment avancer

Corrige dans l'ordre des priorités, une case à la fois. Découpe `model.js` par petites étapes en relançant la page et en essayant une commande et un conseil après chacune : c'est l'**affinage successif**. À chaque fois que tu touches le fichier, laisse-le un peu plus propre que tu ne l'as trouvé (**règle du boy-scout**). Relance `/refactor model.js` quand tu auras coché les priorités hautes pour mesurer les progrès.
