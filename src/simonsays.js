const Promise = require('bluebird');
const fs = require('fs-extra');
const endsWith = require('lodash/endsWith');
const find = require('lodash/find');
const flattenDeep = require('lodash/flattenDeep');
const includes = require('lodash/includes');
const reduce = require('lodash/reduce');
const uniq = require('lodash/uniq');
const path = require('path');

const AngularJSCompiler = require('./compiler/angularjs');
const HtmlCompiler = require('./compiler/html');

const AngularJSFinder = require('./finder/angularjs');

const AngularJSParser = require('./parser/angularjs');
const HtmlParser = require('./parser/html');
const TranslationsParser = require('./parser/translations');

module.exports = class SimonSays {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
  }

  async check(byModule = false, locale = 'fr_FR') {
    let modules = [{
      path: this.sourcePath,
      exclude: [],
    }];

    if (byModule) {
      modules = await this.findModules();
    }

    modules = await Promise.mapSeries(
      modules,
      async (module) => {
        const used = await SimonSays.findUsed(module);

        const { missings, compatibles, declared } = await SimonSays.findDeclaredTranslations({
          ...module,
          used,
        }, locale);
        return {
          ...module,
          used,
          declared,
          missings,
          compatibles,
        };
      },
    );

    return modules;
  }

  async search(projectPath, byModule = false, locale = 'fr_FR', merge = false, all = false) {
    let modules = await this.check(byModule, locale);

    // if merge on merge sinon non
    modules = modules.map(module => ({
      ...module,
      missings: merge ? [
        ...module.missings,
        ...Object.keys(module.compatibles),
      ].sort() : module.missings,
    }));

    return Promise.mapSeries(
      modules,
      async (module) => {
        const { missings, compatibles } = await SimonSays.findInProject(
          module,
          projectPath,
          locale,
        );

        let compatiblesTranslations = compatibles;
        if (all) {
          if (merge) {
            compatiblesTranslations = Object.assign(
              module.declared,
              compatibles,
            );
          } else {
            compatiblesTranslations = Object.assign(
              compatibles,
              module.declared,
            );
          }
        }

        return {
          ...module,
          missings,
          compatibles: compatiblesTranslations,
        };
      },
    );
  }

  async rewrite(
    projectPath,
    byModule = false,
    locale = 'fr_FR',
    merge = false,
    all = false,
    prefix = '',
  ) {
    const modules = await this.search(projectPath, byModule, locale, merge, all);
    const modulesToUpdate = modules.filter(module => Object.keys(module.compatibles).length > 0);

    const prefixTranslationKey = prefix !== '';
    let translationPrefix = '';
    if (prefixTranslationKey) {
      translationPrefix = endsWith(prefix, '_') ? prefix : `${prefix}_`;
    }

    return Promise.mapSeries(
      modulesToUpdate,
      async (module) => {

        let moduleRenamed = module;

        if (prefixTranslationKey) {
          moduleRenamed = await SimonSays.renameTranslations(
            module,
            translationPrefix,
          );
        }

        const translationFile = await SimonSays.generateTranslationFile(moduleRenamed, locale);
        return {
          ...moduleRenamed,
          translationFile,
        };
      },
    );
  }

  findModules() {
    const finder = new AngularJSFinder(this.sourcePath);
    return finder.findModulesPath();
  }

  static async findUsed(modulePath) {
    const htmlParser = new HtmlParser(modulePath);
    const angularJSParser = new AngularJSParser(modulePath);

    const angularTranslations = await angularJSParser.execute();
    const htmlTranslations = await htmlParser.execute();

    return uniq(flattenDeep([
      angularTranslations,
      htmlTranslations,
    ])).sort();
  }

  static async findDeclaredTranslations(modulePath, locale) {
    const translationsParser = new TranslationsParser(modulePath, locale);

    const availableTranslations = await translationsParser.execute();
    return {
      declared: availableTranslations,
      missings: SimonSays.getMissingTranslations(modulePath.used, availableTranslations),
      compatibles: SimonSays.getCompatibleTranslations(modulePath.used, availableTranslations),
    };
  }

  static getMissingTranslations(translations, availableTranslations) {
    return translations.reduce((acc, key) => {
      if (key) {
        const searchRegex = RegExp(`^${key.replace(/\*/g, '.+')}$`);

        if (!includes(Object.keys(availableTranslations), key)
        && !find(
          Object.keys(availableTranslations),
          translation => searchRegex.test(translation),
        )) {
          acc.push(key);
        }
      }

      return acc;
    }, []);
  }

  static getCompatibleTranslations(translations, availableTranslations) {
    return Object.keys(availableTranslations).reduce((acc, key) => {
      if (includes(translations, key)
        || find(translations, use => RegExp(`^${use.replace(/\*/g, '.+')}$`).test(key))) {
        return {
          ...acc,
          [key]: availableTranslations[key],
        };
      }
      return acc;
    }, {});
  }

  static async findInProject(module, sourcePath, locale) {
    const translationsParser = new TranslationsParser(
      {
        path: sourcePath,
        exclude: [],
      },
      locale,
    );

    const availableTranslations = await translationsParser.execute();

    return {
      missings: SimonSays.getMissingTranslations(module.missings, {
        ...availableTranslations,
        ...module.compatibles,
      }),
      compatibles: {
        ...module.compatibles,
        ...SimonSays.getCompatibleTranslations(module.missings, availableTranslations),
      },
    };
  }

  static async generateTranslationFile(module, locale) {
    const directoryPath = path.join(module.path, 'translations');
    const translationsFile = path.join(directoryPath, `Messages_${locale}.json`);

    await fs.ensureDir(directoryPath);
    await fs.writeJSON(
      translationsFile,
      module.compatibles,
      {
        spaces: 2,
      },
    );
    return translationsFile;
  }

  static async renameTranslations(module, prefix) {
    const usedMap = reduce(module.used, (acc, used) => {
      acc[used] = `${prefix}${used}`;
      return acc;
    }, {});

    const compatiblesRenamedMap = reduce(
      module.compatibles,
      (acc, translation, key) => {
        acc[key] = `${prefix}${key}`;
        return acc;
      },
      {},
    );

    const missings = reduce(module.missings, (acc, missing) => {
      acc.push(`${prefix}${missing}`);
      return acc;
    }, []);

    const compatibles = reduce(
      module.compatibles,
      (acc, translation, key) => {
        acc[`${prefix}${key}`] = translation;
        return acc;
      },
      {},
    );


    const angularJSCompiler = new AngularJSCompiler(module);
    const htmlCompiler = new HtmlCompiler(module);

    await angularJSCompiler.execute({
      ...compatiblesRenamedMap,
      ...usedMap,
    });
    await htmlCompiler.execute({
      ...compatiblesRenamedMap,
      ...usedMap,
    });

    return {
      ...module,
      used: Object.values(usedMap),
      missings,
      compatibles,
    };
  }
};
