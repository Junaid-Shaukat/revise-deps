#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const semver = require('semver');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const program = new Command();
const pkg = require('./package.json');
const packageJson = require(`${process.cwd()}/package.json`);

const outdatedDepsFilePath = path.join(process.cwd(), 'outdated-deps.json');

program
  .version(pkg.version)
  .description('Dependency Management and Security Scanner');

program
  .command('scan')
  .description('Scan project dependencies')
  .action(scanDependencies);

program
  .command('audit')
  .description('Check for vulnerabilities')
  .action(auditDependencies);

program
  .command('update')
  .description('Update dependencies to the latest stable versions')
  .action(updateDependencies);

program.parse(process.argv);

function scanDependencies() {
  console.log(chalk.blue('Scanning dependencies...'));
  const dependencies = packageJson.dependencies;
  const devDependencies = packageJson.devDependencies;
  let outdatedDeps = []; // Array to store outdated dependencies

  listDependencies(dependencies, 'Dependencies', outdatedDeps);
  listDependencies(devDependencies, 'DevDependencies', outdatedDeps);

  // Write outdated dependencies to a file
  fs.writeFileSync(outdatedDepsFilePath, JSON.stringify(outdatedDeps, null, 2), 'utf8');

  if (outdatedDeps.length > 0) {
    console.log(chalk.blue('\nRun the following commands to update dependencies:'));
    outdatedDeps.forEach(dep => console.log(chalk.green(`npm install ${dep}@latest --save`)));
  } else {
    console.log(chalk.green('All dependencies are up-to-date.'));
  }
}

function listDependencies(deps, type, outdatedDeps) {
  if (!deps) return;

  console.log(chalk.green(`\n${type}:`));
  for (const [dep, version] of Object.entries(deps)) {
    const currentVersion = semver.coerce(version)?.version;
    if (!currentVersion) {
      console.error(chalk.red(`Invalid version for ${dep}: ${version}`));
      continue;
    }
    try {
      const latestVersion = execSync(`npm show ${dep} version`).toString().trim();
      if (semver.lt(currentVersion, latestVersion)) {
        console.log(`${chalk.yellow(dep)}: ${chalk.red(version)} -> ${chalk.green(latestVersion)}`);
        outdatedDeps.push(dep);
      } else {
        console.log(`${chalk.yellow(dep)}: ${chalk.green(version)} (up-to-date)`);
      }
    } catch (error) {
      if (error.message.includes('E404')) {
        console.error(chalk.red(`Package ${dep} not found in the registry.`));
      } else {
        console.error(chalk.red(`Failed to fetch latest version for ${dep}: ${error.message.split('\n')[0]}`));
      }
    }
  }
}


function auditDependencies() {
  console.log(chalk.blue('Checking for vulnerabilities...'));
  try {
    const result = execSync('npm audit --json');
    const auditResult = JSON.parse(result.toString());

    if (auditResult.metadata.vulnerabilities.total === 0) {
      console.log(chalk.green('No vulnerabilities found.'));
    } else {
      for (const [severity, issues] of Object.entries(auditResult.metadata.vulnerabilities)) {
        if (issues > 0) {
          console.log(chalk.red(`${severity}: ${issues}`));
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('Error running npm audit:', error.message.split('\n')[0]));
  }
}

function updateDependencies() {
  console.log(chalk.blue('Updating outdated dependencies...'));

  if (!fs.existsSync(outdatedDepsFilePath)) {
    console.log(chalk.red('No outdated dependencies found. Please run "revise-deps scan" first.'));
    return;
  }

  const outdatedDeps = JSON.parse(fs.readFileSync(outdatedDepsFilePath, 'utf8'));

  if (outdatedDeps.length === 0) {
    console.log(chalk.green('All dependencies are up-to-date.'));
    return;
  }

  outdatedDeps.forEach(dep => {
    try {
      execSync(`npm install ${dep}@latest`, { stdio: 'inherit' });
      console.log(chalk.green(`Updated ${dep} to the latest version`));
    } catch (error) {
      console.error(chalk.red(`Failed to update ${dep}: ${error.message.split('\n')[0]}`));
    }
  });

  // Clean up the outdated dependencies file
  fs.unlinkSync(outdatedDepsFilePath);
}
