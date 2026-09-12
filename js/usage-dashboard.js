import { auth, onIdTokenChanged } from './firebase-config.js';
import { usageRequest } from './usage-client.js';

const featureLabels = {trainer_start:'Trainer-Starts',quiz_start:'Quiz-Starts',simulation_start:'Prüfungssimulations-Starts',
  podcast_start:'Podcast-Starts',learning_text_open:'Lerntext-Aufrufe',flashcards_start:'Karteikarten-Starts',
  glossary_open:'Glossar-Aufrufe',formulas_open:'Formelsammlung-Aufrufe',progress_open:'Lernstand-Aufrufe',
  kilian_open:'Frag-Kilian-Aufrufe',kilian_use:'Frag-Kilian-Verwendungen'};
const subjectLabels = {unknown:'Unbekannt / gemischt',recht:'Recht',steuern:'Steuern',rechnungswesen:'Rechnungswesen',
  bwl:'BWL',vwl:'VWL',unternehmensfuehrung:'Unternehmensführung',fuehrung_zusammenarbeit:'Führung und Zusammenarbeit',
  betriebliches_management:'Betriebliches Management',logistik:'Logistik',marketing:'Marketing',vertrieb:'Vertrieb',
  investition_finanzierung:'Investition und Finanzierung',rechnungswesen_controlling:'Betriebliches Rechnungswesen und Controlling',
  finance_controlling:'Finance Controlling'};
const subjectFeatureKeys = ['trainer_start','quiz_start','simulation_start','podcast_start','learning_text_open','flashcards_start'];

export function usageSummary(data, period) {
  if (!['7','30','all'].includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(data?.today) || !Array.isArray(data.days)) throw Error('invalid_data');
  const today = Date.parse(data.today + 'T00:00:00Z');
  if (!Number.isFinite(today)) throw Error('invalid_data');
  const byDate = new Map();
  for (const day of data.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || day.date > data.today || !day.counts || typeof day.counts !== 'object') continue;
    byDate.set(day.date, day.counts);
  }
  const first = period === 'all' ? ([...byDate.keys()].sort()[0] || data.today) : new Date(today - (Number(period)-1)*86400000).toISOString().slice(0,10);
  const features = Object.fromEntries(Object.keys(featureLabels).map(key => [key,0]));
  const subjects = {}, subjectFeatures = {}, areas = {WQ:0,HQ:0}, days = [];
  let total = 0;
  for (let date = Date.parse(first + 'T00:00:00Z'); date <= today; date += 86400000) {
    const key = new Date(date).toISOString().slice(0,10); let dayTotal = 0;
    for (const [dimensions,count] of Object.entries(byDate.get(key) || {})) {
      const [event,subject,area,...extra] = dimensions.split('|');
      if (extra.length || !window.WifaUsageSchema.clean({event,subject,area}) || !Number.isSafeInteger(count) || count < 0) continue;
      features[event] += count; dayTotal += count;
      if (subjectFeatureKeys.includes(event)) {
        subjects[subject] = (subjects[subject] || 0) + count;
        if (!subjectFeatures[subject]) subjectFeatures[subject] = Object.fromEntries(subjectFeatureKeys.map(key => [key,0]));
        subjectFeatures[subject][event] += count;
      }
      if (event === 'simulation_start' && Object.hasOwn(areas,area)) areas[area] += count;
    }
    days.push({date:key,total:dayTotal}); total += dayTotal;
  }
  return {total,features,subjects,subjectFeatures,areas,days};
}

if (typeof document !== 'undefined') {
  const status = document.getElementById('usageStatus'), content = document.getElementById('usageResults');
  const period = document.getElementById('usagePeriod'), refresh = document.getElementById('usageRefresh');
  let revision = 0;
  const number = value => value.toLocaleString('de-DE');
  function rows(target, entries) {
    const body = document.getElementById(target); body.replaceChildren();
    for (const [label,value] of entries) {
      const row = document.createElement('tr'), name = document.createElement('th'), count = document.createElement('td');
      name.scope = 'row'; name.textContent = label; count.textContent = number(value);
      row.append(name,count); body.append(row);
    }
  }
  async function refreshData() {
    const requestRevision = ++revision, user = auth.currentUser, selected = period.value;
    content.hidden = true; refresh.disabled = true;
    document.getElementById('usageTotal').textContent = '0';
    for (const id of ['usageFeatures','usageSubjects','usageSubjectDetails','usageAreas','usageDays','usageTrend']) document.getElementById(id).replaceChildren();
    if (!user || !user.emailVerified) {
      status.textContent = 'Bitte melde dich zuerst im Trainer mit deinem bestätigten Administrationskonto an.';
      refresh.disabled = false; return;
    }
    status.textContent = 'Berechtigung und Nutzungszahlen werden geladen …';
    try {
      const idToken = await user.getIdToken();
      if (requestRevision !== revision || auth.currentUser !== user) return;
      const result = await usageRequest({action:'usageRead',idToken,period:selected});
      if (requestRevision !== revision || auth.currentUser !== user) return;
      if (!result?.success) {
        const messages = {forbidden:'Für dieses Konto ist keine Statistikberechtigung hinterlegt.',
          unauthenticated:'Die Anmeldung konnte nicht bestätigt werden. Bitte melde dich im Trainer erneut an.',
          rate_limited:'Das Anfragelimit ist erreicht. Bitte versuche es später erneut.'};
        status.textContent = messages[result?.error] || 'Statistik derzeit nicht verfügbar. Die private Backend-Einrichtung muss abgeschlossen und aktiviert sein.';
        return;
      }
      const summary = usageSummary(result.data,selected);
      document.getElementById('usageTotal').textContent = number(summary.total);
      rows('usageFeatures', Object.entries(summary.features).sort((a,b) => b[1]-a[1]).map(([key,value]) => [featureLabels[key],value]));
      rows('usageSubjects', Object.entries(summary.subjects).sort((a,b) => b[1]-a[1]).map(([key,value]) => [subjectLabels[key],value]));
      const subjectDetails = document.getElementById('usageSubjectDetails');
      for (const [subject,counts] of Object.entries(summary.subjectFeatures).sort((a,b) => summary.subjects[b[0]]-summary.subjects[a[0]])) {
        const row = document.createElement('tr'), name = document.createElement('th');
        name.scope = 'row'; name.textContent = subjectLabels[subject]; row.append(name);
        for (const key of subjectFeatureKeys) { const count = document.createElement('td'); count.textContent = number(counts[key]); row.append(count); }
        subjectDetails.append(row);
      }
      rows('usageAreas', [['WQ',summary.areas.WQ],['HQ',summary.areas.HQ]]);
      rows('usageDays', summary.days.slice().reverse().map(day => [day.date + (day.date === result.data.today ? ' (läuft)' : ''),day.total]));
      const chart = document.getElementById('usageTrend'); chart.replaceChildren();
      const maximum = Math.max(1,...summary.days.map(day => day.total));
      for (const day of summary.days) {
        const bar = document.createElement('span'); bar.className = 'usage-bar';
        bar.style.height = (day.total / maximum * 100) + '%';
        bar.title = day.date + ': ' + number(day.total); chart.append(bar);
      }
      content.hidden = false;
      status.textContent = summary.total ? 'Aggregierte Nutzungen im gewählten Zeitraum. Heute ist noch nicht abgeschlossen (Europe/Berlin).' : 'Für diesen Zeitraum liegen noch keine Nutzungen vor.';
    } catch (_) {
      if (requestRevision === revision) status.textContent = 'Statistik konnte nicht geladen werden. Bitte versuche es später erneut.';
    } finally { if (requestRevision === revision) refresh.disabled = false; }
  }
  refresh.addEventListener('click',refreshData); period.addEventListener('change',refreshData);
  onIdTokenChanged(auth,refreshData);
}
