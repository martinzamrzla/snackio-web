# snackio-web

Web společnosti Snackio Solutions s.r.o. — https://snackiosolutions.cz

## Co je kde

- `public/` — vše, co se publikuje na web
  - `index.html` — obsah stránky
  - `assets/css/site.css` — vzhled
  - `assets/js/site.js` — chování stránky (navigace, filtry, kalkulačka, poptávka)
  - `assets/js/stage.min.js` — 3D scéna s automatem (vygenerovaný soubor, needitovat ručně)
  - `assets/img/`, `assets/fonts/` — logo, záložní obrázky scény, písma (Unbounded, Instrument Sans; licence OFL)
- `src/stage.js` — zdrojový kód 3D scény (three.js)
- `netlify.toml` — nastavení nasazení (publikuje se jen složka `public/`)

## Úprava 3D scény

Po změně `src/stage.js` je potřeba znovu vytvořit `stage.min.js`:

```
npm install
npm run build
```

Texty, vzhled a ostatní chování se upravují přímo v `public/` bez dalšího kroku.

## Nasazení

Repozitář je napojený na Netlify (projekt `mellow-naiad-4c31ad`). Každý push do větve `main` se automaticky nasadí na snackiosolutions.cz. Předchozí verzi lze v Netlify obnovit v sekci Deploys.
