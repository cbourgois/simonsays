const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const fs = require('fs-extra');
const Promise = require('bluebird');
const cheerio = require('cheerio');
const glob = require('glob-promise');
const flattenDeep = require('lodash/flattenDeep');
const trim = require('lodash/trim');
const path = require('path');

const $interpolate = require('../angularjs/interpolate');
const $ParseProvider = require('../angularjs/parse');

module.exports = class HtmlCompiler {
  constructor({ path: sourcePath, exclude }) {
    this.sourcePath = sourcePath;
    this.exclude = exclude;
  }

  async execute(renameMap) {
    this.renameMap = renameMap;

    const parser = new $ParseProvider();
    [, this.$parse] = parser.$get;

    const files = await glob(path.join(this.sourcePath, '**', '*.html'), {
      ignore: this.exclude,
    });

    const result = await Promise.mapSeries(
      files,
      (file) => {
        const data = fs.readFileSync(file, 'utf8');
        const code = this.parseTemplate(file, data);
        return fs.writeFile(file, code);
      },
    );
    return flattenDeep(result);
  }

  parseTemplate(file, data) {
    const $ = cheerio.load(data, {
      decodeEntities: false,
    });
    // $('svg').remove();
    const elements = $('*');

    $(elements).each((index, element) => {
      // TODO : check if
      // <p>
      //   {{ ...}}
      //   <span></span>
      // </p>
      if ($(element).children().length === 0 && trim($(element).text()) !== '') {
        $(element).text(
          this.replaceAttributeValue($(element).text()),
        );
      }

      const attributes = $(element).attr();

      Object.keys(attributes).forEach((key) => {
        const cleanedKey = key.replace('data-', '');

        if (cleanedKey === 'translate') {
          $(element).attr(key, this.replaceAttributeValue(attributes[key], true));
        } else {
          $(element).attr(key, this.replaceAttributeValue(attributes[key]));
        }
      });
    });

    return $.html()
      .replace('<html><head></head><body>', '')
      .replace('</body></html>', '');
  }

  replaceAttributeValue(value, identifier = false) {
    const interpolation = $interpolate(value);

    let returnValue = value;

    if (interpolation.literal && identifier) {
      returnValue = this.renameMap[interpolation.literal];
    } else if (interpolation.expressions.length > 0) {
      interpolation.expressions.forEach((expression) => {
        const [translationKey] = this.parseExpression(expression, identifier);
        const newTranslationKey = this.renameMap[translationKey] || translationKey;
        let newExpression = expression.replace(translationKey, newTranslationKey);

        if (translationKey.indexOf('*') > -1) {
          const [translationPart] = translationKey.split('*');

          const [newTranslationPart] = newTranslationKey.split('*');
          newExpression = expression.replace(translationPart, newTranslationPart);
        }

        returnValue = returnValue.replace(expression, newExpression);
      });
    }

    return returnValue;
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
              translationKeys.push(HtmlCompiler.buildBinaryExpression(translationKeyNode));
            } else if (t.isLiteral(translationKeyNode)) {
              translationKeys.push(translationKeyNode.value);
            }
          }
        },
      });
    } catch (error) {
      // oups
      // console.log(error);
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
      left = HtmlCompiler.buildBinaryExpression(node.left);
    }

    if (t.isLiteral(node.right)) {
      right = node.right.value;
    } else if (node.left.type === 'BinaryExpression') {
      right = HtmlCompiler.buildBinaryExpression(node.right);
    }

    return left + right;
  }
};
