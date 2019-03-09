# SimonSays

[![npm version](https://badgen.net/npm/v/@cbourgois/simonsays)](https://www.npmjs.com/package/@cbourgois/simonsays) [![Dependencies](https://badgen.net/david/dep/ovh-ux/manager/packages/manager/modules/core)](https://npmjs.com/package/@cbourgois/simonsays?activeTab=dependencies) [![Dev Dependencies](https://badgen.net/david/dev/ovh-ux/manager/packages/manager/modules/core)](https://npmjs.com/package/@cbourgois/simonsays?activeTab=dependencies)

> "Jacques a dit" Like.

`simonsays` help you: to find translations key used in your project and:
* check if translations are availables in your project sources
* search translations in another project
* rewrite complete translations files (and support prefixing translations key)

To do it, `simonsays` parse your javascript and html files to detect [`angular-translate`](https://github.com/angular-translate/angular-translate) usages.

Simonsays detect :
* `$translate` and `$translate.instant` calls in your javascript files,
* `translate` directives in your HTML files,
* `translate` filter usages in your HTML files.

We use `@babel/parser` to parse your javascript code in AST and we have ported `$interpolate` and `$ParseProvider` from AngularJS ([code available here](./src/angularjs)).

`Simonsays` supports translations defined in JSON or XML files.

## Installation

With `yarn`:

```bash
yarn add @cbourgois/simonsays
```

or

With `npm`:
```bash
npm install @cbourgois/simonsays
```

## Usage

## CLI Usage

With `npx`:

```bash
npx @cbourgois/simonsays --help
```

### Check

Compatibles options: `--locale`, `--module`, `--output`.

To check used translations:

```bash
simonsays check <sourcePath>
```


### Search

```bash
simonsays search <sourcePath> <projectPath>
```

To search used translations (only used translations will be reported):

```bash
simonsays search <sourcePath> <projectPath>
```

To search used translations and retrieve all (already present translations + used translations):

```bash
simonsays search <sourcePath> <projectPath> --all
```

To overwrite existing translations by the project translations:

```bash
simonsays search <sourcePath> <projectPath> --merge
```

Compatibles options: `--all`, `--merge`, `--locale`, `--module`, `--output`.

### Rewrite

To rewrite JSON translations file:

```bash
simonsays rewrite <sourceDir> <projectPath>
```

To rewrite JSON translations file and prefix translations (AngularJS code and html will be overwritten):

```bash
simonsays rewrite <sourceDir> <projectPath> --prefix=ng_
```

Compatibles options: `--all`, `--merge`, `--locale`, `--module`, `--output`, `--prefix`.


### CLI Options

#### AngularJS module

By default, the script parse all the source path and will generate one, and only one translation file.
If you want, you can specify the `--module` option to parse/generate translations for each AngularJS module contained in the source path.

For example:

```bash
simonsays check <sourcePath> --module
```

#### Locale

By default, `simonsays` target the `fr_FR` locale, but you can change it by specifying `--locale` option.

For example:

```bash
simonsays check <sourcePath> --locale=en_GB
```

#### Output

You can specify an output format from the following:

* `summary` (default) : output a table with the results
* `text` : output a table with num of results
* `json` : output a json
* `silent` : no output

For example:

```bash
simonsays search <sourcePath> <projectPath> --output=text
```

## About

This project embed some portions of AngularJS source code (see `./src/angularjs/**`).
