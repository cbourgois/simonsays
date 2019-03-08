const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const Promise = require('bluebird');
const fs = require('fs-extra');
const glob = require('glob-promise');
const uniq = require('lodash/uniq');
const path = require('path');

module.exports = class AngularJSFinder {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
  }

  async findModulesPath() {
    const sourceFiles = await glob(path.join(this.sourcePath, '**', '*.js'));
    const result = await Promise.mapSeries(
      sourceFiles,
      (sourceFile) => {
        const data = fs.readFileSync(sourceFile, 'utf8');
        return {
          sourceFile,
          isModule: AngularJSFinder.containsModuleDefinition(sourceFile, data),
        };
      },
    );

    const modulePaths = uniq(
      result
        .filter(({ isModule }) => isModule)
        .map(moduleFile => path.dirname(moduleFile.sourceFile)).sort(),
    );

    return modulePaths.map(
      modulePath => ({
        path: modulePath,
        exclude: modulePaths
          .filter(ignorePath => ignorePath !== modulePath
              && path.relative(modulePath, ignorePath).indexOf('..') !== 0)
          .map(ignorePath => `${ignorePath}/**/*`),
      }),
    );
  }

  static containsModuleDefinition(file, data) {
    const ast = parse(data, {
      sourceType: 'module',
      plugins: [
        'dynamicImport',
      ],
    });

    let isModuleDefinition = false;
    traverse(ast, {
      CallExpression(callPath) {
        const { node } = callPath;
        if (t.isMemberExpression(node.callee)
          && t.isIdentifier(node.callee.object)
          && node.callee.object.name === 'angular'
          && t.isIdentifier(node.callee.property)
          && node.callee.property.name === 'module'
          && node.arguments.length === 2
          && t.isArrayExpression(node.arguments[1])) {
          isModuleDefinition = true;
        }
      },
    });

    return isModuleDefinition;
  }
};
