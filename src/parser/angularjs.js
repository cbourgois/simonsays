const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const Promise = require('bluebird');
const fs = require('fs-extra');
const glob = require('glob-promise');
const flattenDeep = require('lodash/flattenDeep');
const find = require('lodash/find');
const path = require('path');

module.exports = class AngularJSParser {
  constructor({ path: sourcePath, exclude }) {
    this.sourcePath = sourcePath;
    this.exclude = exclude;
  }

  async execute() {
    const files = await glob(path.join(this.sourcePath, '**', '*.js'), {
      ignore: this.exclude,
    });
    const result = await Promise.mapSeries(
      files,
      (file) => {
        const data = fs.readFileSync(file, 'utf8');
        return AngularJSParser.parseJSFile(file, data);
      },
    );

    return flattenDeep(result);
  }

  static parseJSFile(file, data) {
    const translations = [];

    const ast = parse(data, {
      sourceType: 'module',
      plugins: [
        'dynamicImport',
      ],
    });

    const classPaths = [];
    const functionPaths = [];
    traverse(ast, {
      ClassDeclaration(classPath) {
        classPaths.push(classPath);
      },
      FunctionDeclaration(functionPath) {
        if (AngularJSParser.isExported(functionPath.getAncestry())) {
          functionPaths.push(functionPath);
        }
      },
      ArrowFunctionExpression(functionPath) {
        if (AngularJSParser.isExported(functionPath.getAncestry())) {
          functionPaths.push(functionPath);
        }
      },
    });

    classPaths.forEach((classPath) => {
      translations.push(AngularJSParser.parseClass(classPath));
    });

    functionPaths.forEach((functionPath) => {
      translations.push(AngularJSParser.parseFunction(functionPath));
    });

    return translations;
  }

  static parseClass(classPath) {
    const translations = [];
    let localTranslateName = false;
    let constructorPath;

    traverse(classPath.node, {
      ClassMethod(methodPath) {
        const { node } = methodPath;
        if (node.kind === 'constructor' && node.params.length > 0) {
          const translateParam = node.params.find(param => t.isIdentifier(param)
            && param.name === '$translate');

          if (translateParam) {
            constructorPath = methodPath;
          }
        }
      },
    }, classPath.scope);

    if (constructorPath) {
      localTranslateName = AngularJSParser.searchConstructorAssign(constructorPath);
    }

    if (localTranslateName) {
      traverse(classPath.node, {
        CallExpression(callPath) {
          const { node } = callPath;

          const isTranslateInstant = t.isMemberExpression(node.callee.object)
            && t.isThisExpression(node.callee.object.object)
            && node.callee.object.property.name === localTranslateName
            && node.callee.property.name === 'instant';

          const isTranslate = t.isThisExpression(node.callee.object)
            && node.callee.property.name === localTranslateName;

          const isConstructorTranslateInstant = AngularJSParser.hasConstructorAncestor(
            callPath.getAncestry(),
          ) && t.isIdentifier(node.callee.object)
            && node.callee.object.name === '$translate'
            && node.callee.property.name === 'instant';

          const isConstructorTranslate = AngularJSParser.hasConstructorAncestor(
            callPath.getAncestry(),
          ) && t.isIdentifier(node.callee)
            && node.callee.name === '$translate';

          if (t.isMemberExpression(node.callee)
            && (
              isTranslate
              || isTranslateInstant
              || isConstructorTranslateInstant
              || isConstructorTranslate
            )
          ) {
            const value = AngularJSParser.getTranslationKeyFromTranslateCall(node.arguments);
            if (value) {
              translations.push(value);
            }
          }
        },
      }, classPath.scope);
    }

    return translations;
  }

  static parseFunction(functionPath) {
    const translations = [];
    const elementNode = functionPath.node;

    const hasTranslateParam = elementNode.params.find(param => t.isIdentifier(param)
      && param.name === '$translate') !== undefined;

    if (hasTranslateParam) {
      traverse(elementNode, {
        CallExpression(callPath) {
          const { node } = callPath;
          const isTranslate = t.isIdentifier(node.callee)
            && node.callee.name === '$translate';

          const isTranslateInstant = node.callee.object
            && t.isIdentifier(node.callee.object)
            && node.callee.object.name === '$translate'
            && node.callee.property.name === 'instant';

          if (isTranslate || isTranslateInstant) {
            const value = AngularJSParser.getTranslationKeyFromTranslateCall(node.arguments);
            if (value) {
              translations.push(value);
            }
          }
        },
      }, functionPath.scope);
    }
    return translations;
  }

  static getTranslationKeyFromTranslateCall(args) {
    if (args.length >= 1) {
      const [argument] = args;
      let value;
      if (t.isStringLiteral(argument)) {
        // eslint-disable-next-line prefer-destructuring
        value = argument.value;
      } else if (t.isTemplateLiteral(argument)) {
        value = AngularJSParser.buildTemplateLiteral(argument);
      }
      return value;
    }
    return undefined;
  }

  static isExported(ancestors) {
    const parent = ancestors[1];
    return t.isExportDefaultDeclaration(parent.node)
      || t.isExportNamedDeclaration(parent.node);
  }

  static hasConstructorAncestor(ancestors) {
    return find(
      ancestors,
      ancestor => t.isClassMethod(ancestor) && ancestor.kind === 'constructor',
    ) !== undefined;
  }

  static buildTemplateLiteral(node) {
    return node.quasis.map(quasi => quasi.value.raw).join('*');
  }

  static searchConstructorAssign(constructorPath) {
    let localName;
    traverse(constructorPath.node, {
      AssignmentExpression(assignmentPath) {
        const { node } = assignmentPath;
        if (node.operator === '='
          && t.isIdentifier(node.right)
          && node.right.name === '$translate'
        ) {
          if (t.isMemberExpression(node.left) && t.isThisExpression(node.left.object)) {
            localName = node.left.property.name;
          }
        }
      },
    }, constructorPath.scope);
    return localName;
  }
};
