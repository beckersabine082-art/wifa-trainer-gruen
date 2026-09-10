const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// The frontend escapes lerntext before rendering; comparison operators are text,
// not HTML. Offsets are used only in JS, then gaps/words travel as UTF-8 JSON.
function prepareLocalInput(lerntext) {
  const text = String(lerntext || '');
  const matches = Array.from(text.matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu));
  if (!matches.length) throw new Error('lerntext enthält keine Wörter');
  return { text, words: matches.map((match, index) => ({
    wortIndex: index, wort: match[0],
    before: index === 0 ? text.slice(0, match.index) : '',
    after: text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length)
  })) };
}

function validateLocalResult(input, result) {
  if (!Number.isFinite(result.duration) || result.duration <= 0 ||
      !Number.isFinite(result.peak) || result.peak < 0.001 ||
      !Number.isFinite(result.rms) || result.rms < 0.0001) throw new Error('Audio leer oder ungültig');
  const marks = result.wortZeitmarken;
  if (!Array.isArray(marks) || marks.length !== input.words.length) throw new Error('Unvollständige Wortabdeckung');
  let previousEnd = 0;
  marks.forEach((mark, index) => {
    if (mark.wortIndex !== index || mark.wort !== input.words[index].wort ||
        !Number.isFinite(mark.start) || !Number.isFinite(mark.end) ||
        mark.start < previousEnd || mark.end <= mark.start || mark.end > result.duration + 0.001) {
      throw new Error('Ungültige lokale Wortzeitmarke: ' + index);
    }
    previousEnd = mark.end;
  });
  const secondsPerWord = result.duration / marks.length;
  if (secondsPerWord < 0.08 || secondsPerWord > 3) throw new Error('Unplausible Audiodauer');
  if (result.duration - previousEnd > 3) throw new Error('Unplausibles Audioende');
  return result;
}

async function generateLocalAudio({ lerntext, outputPath, python = process.env.PODCAST_PYTHON,
  model = process.env.PODCAST_PIPER_MODEL }) {
  if (!python || !model) throw new Error('PODCAST_PYTHON und PODCAST_PIPER_MODEL müssen lokal konfiguriert sein');
  const input = prepareLocalInput(lerntext);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const inputPath = outputPath + '.input.json';
  const resultPath = outputPath + '.alignment.json';
  fs.writeFileSync(inputPath, JSON.stringify(input));
  try {
    await run(python, [path.join(__dirname, 'local_audio.py'), '--model', model,
      '--input', inputPath, '--output', outputPath, '--result', resultPath], {
      windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    const result = validateLocalResult(input, JSON.parse(fs.readFileSync(resultPath, 'utf8')));
    if (fs.statSync(outputPath).size < 1000) throw new Error('MP3 leer');
    return result;
  } finally {
    for (const file of [inputPath, resultPath, outputPath + '.wav']) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

module.exports = { prepareLocalInput, validateLocalResult, generateLocalAudio };
