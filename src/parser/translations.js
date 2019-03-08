const Promise = require('bluebird');
const fs = require('fs-extra');
const glob = require('glob-promise');
const path = require('path');
const xml2json = require('xml2json');

module.exports = class TranslationsParser {
  constructor({ path: sourcePath, exclude }, locale) {
    this.sourcePath = sourcePath;
    this.exclude = exclude;
    this.locale = locale;
  }

  async execute() {
    const files = await glob(path.join(this.sourcePath, '**', `Messages_${this.locale}.@(json|xml)`), {
      ignore: this.exclude,
    });
    const translationParts = await Promise.mapSeries(
      files,
      (file) => {
        const data = fs.readFileSync(file, 'utf8');
        return TranslationsParser.parseFile(file, data);
      },
    );

    return translationParts.reduce((acc, translationPart) => ({
      ...acc,
      ...translationPart,
    }), {});
  }

  static parseFile(file, content) {
    let translationKeys = [];
    if (path.extname(file) === '.json') {
      const translations = JSON.parse(content);
      translationKeys = translations;
    } else {
      const { translation: translations } = JSON.parse(xml2json.toJson(content)).translations;

      translationKeys = translations.reduce((acc, translation) => {
        acc[translation.id] = translation.$t;
        return acc;
      }, {});
    }

    return translationKeys;
  }
};
