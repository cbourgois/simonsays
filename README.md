# SimonSays

> "Jacques a dit" Like.

## Usage

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
simonsays check <sourcePath> <projectPath>
```

To search used translations and retrieve all (already present translations + used translations):

```bash
simonsays check <sourcePath> <projectPath> --all
```

To overwrite existing translations by the project translations:

```bash
simonsays check <sourcePath> <projectPath> --merge
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

.option('-p, --prefix [prefix]', 'prefix translations key by specified prefix')

Compatibles options: `--all`, `--merge`, `--locale`, `--module`, `--output`, `--prefix`.


## Options

### AngularJS module

By default, the script parse all the source path and will generate one, and only one translation file.
If you want, you can specify the `--module` option to parse/generate translations for each AngularJS module contained in the source path.

For example:

```bash
simonsays check <sourcePath> --module
```

### Locale

By default, `simonsays` target the `fr_FR` locale, but you can change it by specifying `--locale` option.

For example:

```bash
simonsays check <sourcePath> --locale=en_GB
```


### Output

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
