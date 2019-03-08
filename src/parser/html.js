const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const glob = require('glob-promise');
const flattenDeep = require('lodash/flattenDeep');
const trim = require('lodash/trim');
const path = require('path');

const $interpolate = require('../angularjs/interpolate');
const $ParseProvider = require('../angularjs/parse');

module.exports = class HtmlParser {
  constructor({ path: sourcePath, exclude }) {
    this.sourcePath = sourcePath;
    this.exclude = exclude;
  }

  async execute() {
    const parser = new $ParseProvider();
    [, this.$parse] = parser.$get;

    const files = await glob(path.join(this.sourcePath, '**', '*.html'), {
      ignore: this.exclude,
    });
    const result = await Promise.mapSeries(
      files,
      (file) => {
        const data = fs.readFileSync(file, 'utf8');
        return this.parseTemplate(file, data);
      },
    );

    return flattenDeep(result);
  }

  parseTemplate(file, data) {
    const $ = cheerio.load(data);
    const translations = [];

    $('svg').remove();

    const content = trim($.text());
    translations.push(
      this.parseAttributeValue(content),
    );

    const elements = $('*');

    $(elements).each((index, element) => {
      const attributes = $(element).attr();

      Object.keys(attributes).map((key) => {
        const cleanedKey = key.replace('data-', '');

        let attributeTranslations = [];
        // console.log(index, key, attributes[key])
        if (cleanedKey === 'translate') {
          // console.log('\t data-translate: ', attributes[key]);
          attributeTranslations = this.parseAttributeValue(attributes[key], true);
        } else {
        // if (['class', 'style'].indexOf(cleanedKey) === -1)
          attributeTranslations = this.parseAttributeValue(attributes[key]);
        }

        // TODO : remove and return to .map and flatDeep
        if (attributeTranslations.length > 0) {
          translations.push(attributeTranslations);
        }
        return attributeTranslations;
      });
    });

    return translations;
  }

  parseAttributeValue(value, identifier = false) {
    let translationsKeys = [];

    const interpolation = $interpolate(value);

    interpolation.expressions.forEach((expression) => {
      translationsKeys = [
        ...translationsKeys,
        this.parseExpression(expression, identifier),
      ];
    });

    if (interpolation.literal && identifier) {
      translationsKeys = [
        ...translationsKeys,
        interpolation.literal,
      ];
    }
    return translationsKeys;
  }

  parseExpression(expression, identifier) {
    const translationKeys = [];

    if (expression.indexOf(' in ') > -1) {
      return translationKeys;
    }

    try {
      const ast = this.getHTMLAst(expression);

      traverse(ast, {
        ExpressionStatement(expressionPath) {
          const { node } = expressionPath;

          if (t.isIdentifier(node.expression) && identifier) {
            translationKeys.push(node.expression.name);
          } else if (t.isMemberExpression(node.expression)) {
            // console.log(node.expression);
          } else {
            // console.log(node.expression.type);
          }
        },
        CallExpression(callPath) {
          const { node } = callPath;
          if (t.isIdentifier(node.callee)
            && node.callee.name === 'translate'
          ) {
            const [translationKeyNode] = node.arguments;
            if (translationKeyNode.type === 'BinaryExpression') {
              translationKeys.push(HtmlParser.buildBinaryExpression(translationKeyNode));
            } else if (t.isLiteral(translationKeyNode)) {
              translationKeys.push(translationKeyNode.value);
            }
          }
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    return translationKeys;
  }

  getHTMLAst(string) {
    return this.$parse().$$getAst(string);
  }

  static buildBinaryExpression(node) {
    let left = '*';
    let right = '*';

    if (t.isLiteral(node.left)) {
      left = node.left.value;
    } else if (node.left.type === 'BinaryExpression') {
      left = HtmlParser.buildBinaryExpression(node.left);
    }

    if (t.isLiteral(node.right)) {
      right = node.right.value;
    } else if (node.left.type === 'BinaryExpression') {
      right = HtmlParser.buildBinaryExpression(node.right);
    }

    return left + right;
  }
};
