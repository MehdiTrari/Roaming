# Isolation visuelle du tutoriel

Le contrôleur Stimulus `assets/controllers/tutorial_highlight_controller.js`
est enregistré automatiquement par le bridge Symfony. Son effet est importé
dans `assets/app.js` via `assets/styles/tutorial-highlight.css`.

L'accueil l'utilise dès le début du parcours : logement → dates → voyageurs →
rechercher. Le flou reste actif entre les étapes ; seule la dernière fait pulser
le bouton « Rechercher ». Il ne lance jamais la recherche automatiquement.
L'accueil ajoute `.booking-bar` au sélecteur `exclude` : tout le module reste
net, y compris les étapes et les champs. Les panneaux du tutoriel ont un fond
transparent derrière eux pour laisser ce module net, sans double assombrissement.

## Twig

Exemple complet : `templates/examples/tutorial_highlight.html.twig`.
Les classes actuelles du bouton et de la navigation restent inchangées.

```twig
<form data-controller="tutorial-highlight"
      data-tutorial-highlight-active-value="{{ tutorialActive|default(false) ? 'true' : 'false' }}"
      data-tutorial-highlight-exclude-value="header.sticky-top, header.sticky-top .dropdown-menu.show"
      data-action="tutorial-highlight:toggle->tutorial-highlight#toggle">
    {# Ajouter uniquement cet attribut au bouton existant : #}
    <button type="submit" data-tutorial-highlight-target="button"
            class="btn btn-primary booking-submit">{{ 'home.search'|trans }}</button>
</form>
```

`tutorialActive` peut être un booléen transmis par Symfony depuis la session.
Il vaut `false` par défaut. Pour un bouton situé hors du conteneur, remplacer
la cible Stimulus par `data-tutorial-highlight-selector-value="#mon-bouton"`.
`exclude` est un sélecteur CSS global ; sa valeur par défaut est `nav`.

## Activer / avancer / arrêter en JavaScript

Le parcours existant utilise un événement local au formulaire :

```js
const form = document.querySelector('#booking-search-form');
form.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {
    detail: {active: true}
}));

// À appeler dès qu'on quitte l'étape ou annule le tutoriel.
form.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {
    detail: {active: false}
}));
```

Depuis un autre contrôleur Stimulus, accès direct possible :

```js
const highlight = this.application.getControllerForElementAndIdentifier(
    form, 'tutorial-highlight'
);
highlight.activate();
highlight.deactivate();
```

Le clic réel sur le bouton, la soumission du formulaire, Échap, le départ Turbo
et la déconnexion du contrôleur suppriment le voile et annulent son animation.
Les événements `tutorial-highlight:activated` et `tutorial-highlight:deactivated`
permettent d'observer ce cycle. L'accueil gère également les clics et déplacements
de focus vers une autre partie du parcours.

## Effet et options

- Voile fixe ajouté en fin de `body`, au-dessus des contextes d'empilement habituels.
- `clip-path: path(evenodd, …)` découpe de vraies ouvertures pour le bouton et la
  navigation. Le fond ET le flou sont absents dans ces ouvertures.
- Le masque suit les dimensions réellement animées à chaque image, le défilement,
  le redimensionnement et l'ouverture des menus. Les exclusions qui se recouvrent
  sont réunies dans leur rectangle englobant pour éviter un recouvrement sombre.
- Le bouton original grandit de 6 % puis revient à sa taille, avec une variation
  douce de luminosité. Aucun clone, sous-calque, halo ou modification des classes,
  couleurs, espacements et arrondis du bouton ou de la navigation.
- Le survol suspend la pulsation pour faciliter le clic. Le réglage de réduction
  des animations ralentit la pulsation et atténue sa variation lumineuse.
- Le voile est décoratif (`aria-hidden`, `pointer-events: none`) : aucun piège de
  focus, aucun doublon de contrôle et aucun clic bloqué dans la navigation.

L'événement de bascule accepte également `pulse: false` pour garder le flou sans
animer le bouton, puis `pulse: true` pour attirer l'attention à la dernière étape.
La valeur Stimulus `pulse` fonctionne aussi directement et vaut `true` par défaut.

Options `data-tutorial-highlight-…-value` : `blur` (5 pixels), `opacity` (0,56),
`scale` (1,06), `duration` (1 800 ms). Les valeurs sont bornées pour garder
un effet modéré. Un seul effet est actif à la fois, même avec plusieurs instances.
Les styles de repli conservent l'assombrissement sans flou si le navigateur ne
prend pas en charge `backdrop-filter`. Sans prise en charge du découpage ou sans
cible visible, le contrôleur n'ajoute aucun voile.

## Vérification locale

```powershell
npm run build
$env:ROAMING_BROWSER_STORAGE='var/local-team-browser-state.json'
node tests/browser/property-showcase.cjs
node tests/browser/tutorial-highlight.cjs
Remove-Item Env:ROAMING_BROWSER_STORAGE
```

Le fichier de session est créé au préalable par le script local d'authentification
équipe ; ne pas le partager ni le committer. Les appels de disponibilité dans ces
tests sont simulés, sans action GuestLucky.
