const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const context = {window: {}, Set, Map, WeakMap};
  vm.runInNewContext(fs.readFileSync('js/analytics-topics.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('js/analytics-core.js', 'utf8'), context);
  const events = [];
  const core = context.window.createWifaAnalyticsCore((name, params) => events.push({name, params}));
  return {core, events};
}
test('consent gates all events and does not replay history', () => {
  const {core, events} = setup();
  core.view('trainerView'); core.start('trainer', 'Recht', 'Rechtssubjekte und Rechtsobjekte');
  assert.equal(events.length, 0);
  core.setEnabled(true); core.view('trainerView');
  assert.equal(events.filter(e => e.name === 'page_view').length, 1);
  core.setEnabled(false); core.view('quizView'); core.complete('trainer');
  assert.equal(events.length, 2);
});
test('views deduplicate rerenders but count returning views', () => {
  const {core, events} = setup(); core.setEnabled(true);
  core.view('trainerView'); core.view('trainerView'); core.view('glossarView'); core.view('trainerView');
  assert.equal(events.filter(e => e.name === 'page_view').length, 3);
});
test('only allowlisted identifiers leave the core', () => {
  const {core, events} = setup(); core.setEnabled(true);
  core.view('mail@example.com'); core.start('evil', 'Recht', 'private');
  assert.equal(events.length, 0);
  core.start('trainer', 'mail@example.com', 'secret?uid=123');
  assert.equal(events[0].params.subject_id, 'unknown');
  assert.equal(events[0].params.topic_id, 'unknown');
  assert.ok(!JSON.stringify(events).includes('secret'));
});
test('one start and completion per defined run, restart permits a new run', () => {
  const {core, events} = setup(); core.setEnabled(true);
  core.start('trainer', 'Recht'); core.start('trainer', 'Recht');
  core.complete('trainer'); core.complete('trainer');
  core.reset('trainer'); core.start('trainer', 'Recht');
  assert.deepEqual(events.map(e => e.name), ['training_start', 'training_complete', 'training_start']);
});
test('topic names map to fixed IDs and error codes cannot use object prototype properties', () => {
  const {core, events} = setup(); core.setEnabled(true);
  core.start('trainer', 'Recht', 'Rechtssubjekte und Rechtsobjekte');
  assert.equal(events[0].params.topic_id, 'recht_34c680d85c33');
  core.audioError('Recht', '', 'constructor');
  assert.equal(events[1].params.error_code, 'unknown');
});
test('revocation drops an in-progress run; explicit podcast restart begins a new run', () => {
  const {core, events} = setup(); core.setEnabled(true);
  core.start('exam', 'Recht'); core.setEnabled(false); core.setEnabled(true); core.complete('exam');
  assert.equal(events.length,1);
  const a = new AudioMock(); core.audio(a,'Recht',''); a.fire('playing');
  core.restartAudio(a); a.fire('playing');
  assert.equal(events.filter(e=>e.name === 'podcast_start').length,2);
});
class AudioMock extends EventTarget {
  currentTime = 0; duration = 100; paused = false; seeking = false; error = null;
  fire(name) { this.dispatchEvent(new Event(name)); }
}
test('podcast listeners, resume, seeking and milestones never double count', () => {
  const {core, events} = setup(); core.setEnabled(true);
  const audio = new AudioMock();
  core.audio(audio, 'Recht', 'Rechtssubjekte und Rechtsobjekte');
  core.audio(audio, 'Recht', 'Rechtssubjekte und Rechtsobjekte');
  audio.fire('playing'); audio.fire('pause'); audio.fire('playing');
  audio.currentTime = 80; audio.fire('timeupdate');
  audio.currentTime = 20; audio.fire('seeked'); audio.currentTime = 80; audio.fire('timeupdate');
  audio.currentTime = 100; audio.fire('ended'); audio.fire('ended');
  assert.equal(events.filter(e => e.name === 'podcast_start').length, 1);
  assert.deepEqual(events.filter(e => e.name === 'podcast_progress').map(e => e.params.progress_percent), [25,50,75,100]);
  audio.error = {code: 3, message: 'private url'}; audio.fire('error'); audio.fire('error');
  assert.equal(events.filter(e => e.name === 'podcast_error').length, 1);
  assert.ok(!JSON.stringify(events).includes('private'));
  core.setEnabled(false); audio.fire('playing'); audio.fire('ended');
  assert.equal(events.length, 6);
});
test('a freshly loaded same podcast is a new run; listener rebinding alone is not', () => {
  const {core, events} = setup(); core.setEnabled(true);
  const a = new AudioMock(); core.audio(a,'Recht',''); a.fire('playing'); a.fire('ended');
  a.fire('emptied'); core.audio(a,'Recht',''); a.currentTime=0; a.fire('playing');
  assert.equal(events.filter(e=>e.name==='podcast_start').length,2);
});
test('native media error and rejected play promise count one sanitized failure', () => {
  const {core, events} = setup(); core.setEnabled(true);
  const a = new AudioMock(); core.audio(a,'Recht',''); a.error={code:4}; a.fire('error');
  core.audioError('Recht','','NotSupportedError');
  assert.equal(events.filter(e=>e.name==='podcast_error').length,1);
});
