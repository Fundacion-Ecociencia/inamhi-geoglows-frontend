# Frontend

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.10.

## Requisitos y llave de CARTO

Se compila con Node 20 (Angular 17 no funciona con versiones más nuevas) y las dependencias se instalan con `npm ci`.

Los mapas base son de CARTO y necesitan una llave, que no se guarda en el repo. Va en `src/environments/carto-key.ts`, que está en `.gitignore`; la plantilla es `carto-key.example.ts`. Al correr `npm start`, `npm run build` o `npm run watch`, el script `scripts/ensure-carto-key.mjs` crea ese archivo si falta: con la llave de la variable de entorno `CARTO_KEY` si está definida, o sin llave, en cuyo caso la aplicación compila pero las capas de CARTO no cargan. Si se usa `ng serve` o `ng build` directamente, el archivo tiene que existir antes.

```bash
CARTO_KEY=<llave> npm run build
```

La llave está restringida en el panel de CARTO al dominio `inamhi.geoglows.org`, así que en local las capas de CARTO responden 403 aunque la llave sea correcta.

## Development server

Run `npm start` (or `ng serve`) for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `npm run build` (or `ng build`) to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
