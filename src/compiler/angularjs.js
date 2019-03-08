const generate = require('@babel/generator').default;
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const Promise = require('bluebird');
const fs = require('fs-extra');
const glob = require('glob-promise');
const find = require('lodash/find');
const forEach = require('lodash/forEach');
const path = require('path');


module.exports = class AngularJSCompiler {
  constructor({ path: sourcePath, exclude }) {
    this.sourcePath = sourcePath;
    this.exclude = exclude;
  }

  async execute(renameMap) {
    this.renameMap = renameMap;

    const files = await glob(path.join(this.sourcePath, '**', '*.js'), {
      ignore: this.exclude,
    });

    return Promise.mapSeries(
      files,
      (file) => {
        const data = fs.readFileSync(file, 'utf8');
        const code = this.parseJSFile(file, data);
        return fs.writeFile(file, code);
      },
    );
  }

  parseJSFile(file, data) {
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
        if (AngularJSCompiler.isExported(functionPath.getAncestry())) {
          functionPaths.push(functionPath);
        }
      },
      ArrowFunctionExpression(functionPath) {
        if (AngularJSCompiler.isExported(functionPath.getAncestry())) {
          functionPaths.push(functionPath);
        }
      },
    });

    forEach(classPaths, (classPath) => {
      this.parseClass(classPath);
    });

    forEach(functionPaths, (functionPath) => {
      this.parseFunction(functionPath);
    });

    return generate(ast, {
      retainLines: true,
      retainFunctionParens: true,
      quotes: 'single',
    }, data)
      .code;
  }

  parseClass(classPath) {
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
      localTranslateName = AngularJSCompiler.searchConstructorAssign(constructorPath);
    }

    if (localTranslateName) {
      const callExpressions = [];
      // search in callExpression in this file with this.$translate
      traverse(classPath.node, {
        CallExpression(callPath) {
          const { node } = callPath;

          const isTranslateInstant = t.isMemberExpression(node.callee.object)
            && t.isThisExpression(node.callee.object.object)
            && node.callee.object.property.name === localTranslateName
            && node.callee.property.name === 'instant';

          const isTranslate = t.isThisExpression(node.callee.object)
            && node.callee.property.name === localTranslateName;

          const isConstructorTranslateInstant = AngularJSCompiler.hasConstructorAncestor(
            callPath.getAncestry(),
          ) && t.isIdentifier(node.callee.object)
            && node.callee.object.name === '$translate'
            && node.callee.property.name === 'instant';

          const isConstructorTranslate = AngularJSCompiler.hasConstructorAncestor(
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
            callExpressions.push(node);
          }
        },
      }, classPath.scope);

      forEach(callExpressions, (callExpression) => {
        // eslint-disable-next-line no-param-reassign
        callExpression.arguments = this.replaceTranslationKeyFromTranslateCall(
          callExpression.arguments,
        );
      });
    }
  }

  parseFunction(functionPath) {
    const callExpressions = [];
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
            callExpressions.push(node);
            // const value = AngularJSCompiler.getTranslationKeyFromTranslateCall(node.arguments);
            // if (value) {
            //   translations.push(value);
            // }
          }
        },
      }, functionPath.scope);

      forEach(callExpressions, (callExpression) => {
        // eslint-disable-next-line no-param-reassign
        callExpression.arguments = this.replaceTranslationKeyFromTranslateCall(
          callExpression.arguments,
        );
      });
    }
  }

  replaceTranslationKeyFromTranslateCall(args) {
    const callArguments = [...args];
    const [firstArgument] = callArguments;

    if (t.isStringLiteral(firstArgument)) {
      callArguments[0].value = this.renameMap[callArguments[0].value];
    } else if (t.isTemplateLiteral(firstArgument)) {
      callArguments[0] = this.buildTemplateLiteral(firstArgument);
    }
    return args;
  }

  static getTranslationKeyFromTranslateCall(args) {
    if (args.length >= 1) {
      const [argument] = args;
      let value;
      if (t.isStringLiteral(argument)) {
        // eslint-disable-next-line prefer-destructuring
        value = argument.value;
      } else if (t.isTemplateLiteral(argument)) {
        value = AngularJSCompiler.buildTemplateLiteral(argument);
      }
      return value;
    }
    return undefined;
  }

  static isExported(ancestors) {
    const parent = ancestors[1];
    return t.isExportDefaultDeclaration(parent.node) || t.isExportNamedDeclaration(parent.node);
  }

  static hasConstructorAncestor(ancestors) {
    return find(
      ancestors,
      ancestor => t.isClassMethod(ancestor.node) && ancestor.node.kind === 'constructor',
    ) !== undefined;
  }

  buildTemplateLiteral(node) {
    const template = node.quasis.map(quasi => quasi.value.raw).join('*');
    const replacement = this.renameMap[template];

    const prefix = replacement.replace(template, '');

    // eslint-disable-next-line no-param-reassign
    node.quasis[0].value.raw = `${prefix}${node.quasis[0].value.raw}`;
    return node;
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
