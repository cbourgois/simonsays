#!/usr/bin/env node
/* eslint-disable no-console */
const chalk = require('chalk');
const Table = require('cli-table3');
const program = require('commander');
const ora = require('ora');
const path = require('path');
const wrapAnsi = require('wrap-ansi');

const SimonSays = require('../src/simonsays');
const pkg = require('../package.json');

const outputModules = (sourcePath, modules, output = 'summary') => {
  if (output === 'summary') {
    const table = new Table({
      head: [
        chalk.yellow('Module'),
        chalk.yellow('Used'),
        chalk.yellow('Missings'),
        chalk.yellow('Results'),
      ],
    });

    table.push(
      ...modules.map((module) => {
        const modulePath = path.relative(sourcePath, module.path);
        const numUsed = module.used.length;
        const numMissings = module.missings.length;
        const numCompatibles = Object.keys(module.compatibles).length;
        return [
          `./${modulePath}`,
          numUsed,
          numMissings > 0 ? chalk.red(numMissings) : chalk.green(numMissings),
          (numCompatibles === 0 && numUsed > 0)
            ? chalk.red(numCompatibles)
            : chalk.green(numCompatibles),
        ];
      }),
    );

    console.log(table.toString());
  }

  if (output === 'text') {
    const table = new Table({
      head: [
        chalk.yellow('Used'),
        chalk.yellow('Missings'),
        chalk.yellow('Results'),
      ],
      colWidths: [null, null, 80],
    });

    const moduleNameRows = modules.map((module) => {
      const modulePath = path.relative(sourcePath, module.path);
      return [
        {
          colSpan: 3,
          hAlign: 'center',
          content: `./${modulePath}`,
        },
      ];
    });
    const moduleRows = modules.map((module) => {
      const usedTranslations = module.used.map((translation) => {
        if (module.missings.indexOf(translation) > -1) {
          return chalk.red(translation);
        }
        if (Object.keys(module.compatibles).indexOf(translation) > -1) {
          return chalk.green(translation);
        }
        return chalk.italic(chalk.blue(translation));
      }).join('\n');


      const missingsTranslations = module.missings.join('\n');
      const compatiblesTranslations = Object.keys(module.compatibles)
        .map(key => wrapAnsi(
          `${chalk.green(key)}: "${chalk.italic(chalk.cyan(module.compatibles[key]))}"`,
          80,
        ))
        .join('\n');

      return [
        usedTranslations,
        missingsTranslations,
        compatiblesTranslations,
      ];
    });

    const rows = moduleNameRows.reduce((acc, value, index) => {
      acc.push(value);
      acc.push(moduleRows[index]);
      return acc;
    }, []);

    table.push(
      ...rows,
    );

    console.log(table.toString());
  }

  if (output === 'json') {
    console.log(modules);
  }
};

program
  .command('check <sourcePath>')
  .alias('c')
  .description('Check if translations are present in AngularJS project')
  .option('--locale [locale]', 'locale code', 'fr_FR')
  .option('--module', 'split by AngularJS module')
  .option('-o, --output [output]', 'output mode (summary|text|json|silent)', 'summary')
  .action(async (sourcePath, options) => {
    if (sourcePath) {
      const absoluteSourcePath = path.resolve(process.cwd(), sourcePath);
      try {
        const spinner = ora(`Check translations for ${sourcePath}`).start();
        const translation = new SimonSays(absoluteSourcePath);
        const modules = await translation.check(
          options.module || false,
          options.locale,
        );
        spinner.succeed();
        outputModules(absoluteSourcePath, modules, options.output || 'summary');
      } catch (error) {
        if (options.output !== 'silent') {
          console.log(error);
        }
        process.exit(1);
      }
    } else {
      program.outputHelp();
    }
  });

program
  .command('search <sourcePath> <projectPath>')
  .alias('s')
  .description('Search missing translations in another directory')
  .option('-a, --all', 'keep unused translations from source')
  .option('--locale [locale]', 'locale code', 'fr_FR')
  .option('-m, --merge', 'prefer project translations')
  .option('--module', 'split by AngularJS module')
  .option('-o, --output [output]', 'output mode (summary|text|json|silent)', 'summary')
  .action(async (sourcePath, projectPath, options) => {
    if (sourcePath && projectPath) {
      const absoluteSourcePath = path.resolve(process.cwd(), sourcePath);
      const absoluteProjectPath = path.resolve(process.cwd(), projectPath);
      try {
        const spinner = ora(`Search translations for ${sourcePath} in project`).start();
        const translation = new SimonSays(absoluteSourcePath);
        const modules = await translation.search(
          absoluteProjectPath,
          options.module || false,
          options.locale,
          options.merge || false,
          options.all || false,
        );
        spinner.succeed();
        outputModules(absoluteSourcePath, modules, options.output || 'summary');
      } catch (error) {
        if (options.output !== 'silent') {
          console.log(error);
        }
        process.exit(1);
      }
    } else {
      program.outputHelp();
    }
  });

program
  .command('rewrite <sourcePath> <projectPath>')
  .alias('r')
  .description('Search missing translations in another directory')
  .option('-a, --all', 'keep unused translations from source')
  .option('--locale [locale]', 'locale code', 'fr_FR')
  .option('-m, --merge', 'prefer project translations')
  .option('--module', 'split by AngularJS module')
  .option('-p, --prefix [prefix]', 'prefix translations key by specified prefix')
  .option('-o, --output [output]', 'output mode (summary|text|json|silent)', 'summary')
  .action(async (sourcePath, projectPath, options) => {
    if (sourcePath && projectPath) {
      const absoluteSourcePath = path.resolve(process.cwd(), sourcePath);
      const absoluteProjectPath = path.resolve(process.cwd(), projectPath);
      try {
        let prefixText = '';
        if (options.prefix) {
          prefixText = ` with prefix:${options.prefix}`;
        }
        const spinner = ora(`Rewrite translations for ${sourcePath}${prefixText}`).start();
        const translation = new SimonSays(absoluteSourcePath);
        const modules = await translation.rewrite(
          absoluteProjectPath,
          options.module || false,
          options.locale,
          options.merge || false,
          options.all || false,
          options.prefix || '',
        );
        spinner.succeed();
        outputModules(absoluteSourcePath, modules, options.output || 'summary');
      } catch (error) {
        if (options.output !== 'silent') {
          console.log(error);
        }
        process.exit(1);
      }
    } else {
      program.outputHelp();
    }
  });


program
  .version(pkg.version)
  .parse(process.argv);
