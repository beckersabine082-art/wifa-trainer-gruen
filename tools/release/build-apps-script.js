'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ENVIRONMENT_TOKEN = '__WIFA_DEPLOYMENT_ENVIRONMENT__';
const SPREADSHEET_ID_TOKEN = '__WIFA_SPREADSHEET_ID__';
const ALLOWED_ENVIRONMENTS = Object.freeze(['STAGING', 'PRODUCTION']);
const SPREADSHEET_IDS = Object.freeze({
  STAGING: '1cJ8Wa92r-_LRmMOf3h3kTqfHV8Qz3ZjERuCP1Un25r8',
  PRODUCTION: '1_PGsBBjPZcc48B1PvwS3XKNVrQgH6Rvarzg4zBbPa7Y'
});

function buildAppsScriptSource(source, environment) {
  const selected = String(environment || '').trim().toUpperCase();
  if (!ALLOWED_ENVIRONMENTS.includes(selected)) {
    throw new Error('Apps-Script-Umgebung muss STAGING oder PRODUCTION sein.');
  }
  const text = String(source);
  const environmentOccurrences = text.split(ENVIRONMENT_TOKEN).length - 1;
  const spreadsheetOccurrences = text.split(SPREADSHEET_ID_TOKEN).length - 1;
  if (environmentOccurrences !== 1 || spreadsheetOccurrences !== 1) {
    throw new Error(`Apps-Script-Buildtoken müssen exakt einmal vorkommen; Umgebung ${environmentOccurrences}, Spreadsheet ${spreadsheetOccurrences}.`);
  }
  return text
    .replace(ENVIRONMENT_TOKEN, selected)
    .replace(SPREADSHEET_ID_TOKEN, SPREADSHEET_IDS[selected]);
}

function cliValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const environment = cliValue(argv, '--environment');
  const input = path.resolve(cliValue(argv, '--input') || 'backend/apps-script/Code.gs');
  const output = cliValue(argv, '--output');
  if (!output) throw new Error('--output ist erforderlich; Buildartefakte werden nie in die Quelle geschrieben.');
  const target = path.resolve(output);
  const built = buildAppsScriptSource(fs.readFileSync(input, 'utf8'), environment);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, built, 'utf8');
  process.stdout.write(JSON.stringify({ environment: String(environment).toUpperCase(), input, output: target }) + '\n');
}

module.exports = { ALLOWED_ENVIRONMENTS, ENVIRONMENT_TOKEN, SPREADSHEET_ID_TOKEN, SPREADSHEET_IDS, buildAppsScriptSource };
