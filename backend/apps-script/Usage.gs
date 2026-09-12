// Aggregate usage only. Helpers are private; visible editor setup also verifies the actual owner.
// No identifiers, tokens, request bodies or account records are persisted/logged.
const USAGE_PROJECT_ = 'wifa-trainer-gruen';
const USAGE_EVENTS_ = ['trainer_start','quiz_start','simulation_start','podcast_start',
  'learning_text_open','flashcards_start','glossary_open','formulas_open','progress_open','kilian_open','kilian_use'];
const USAGE_SUBJECTS_ = ['unknown','recht','steuern','rechnungswesen','bwl','vwl','unternehmensfuehrung',
  'fuehrung_zusammenarbeit','betriebliches_management','logistik','marketing','vertrieb',
  'investition_finanzierung','rechnungswesen_controlling','finance_controlling'];

function usageFail_(code) { const error = new Error(code); error.usageCode = code; throw error; }
function usageObject_(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value,key));
}
function usageEventKey_(event) {
  if (!usageObject_(event,['event','subject','area']) || !USAGE_EVENTS_.includes(event.event) ||
      !USAGE_SUBJECTS_.includes(event.subject) || !['none','WQ','HQ'].includes(event.area) ||
      (event.event !== 'simulation_start' && event.area !== 'none') ||
      (['glossary_open','formulas_open','progress_open','kilian_open','kilian_use'].includes(event.event) && event.subject !== 'unknown')) {
    usageFail_('invalid_request');
  }
  return event.event + '|' + event.subject + '|' + event.area;
}
function usageValidate_(body) {
  const read = body && body.action === 'usageRead';
  if (!usageObject_(body,read ? ['action','idToken','period'] : ['action','idToken','events']) ||
      !['usageRecord','usageRead'].includes(body.action) || JSON.stringify(body).length > 16384) usageFail_('invalid_request');
  if (read) {
    if (!['7','30','all'].includes(body.period)) usageFail_('invalid_request');
    return [];
  }
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 10) usageFail_('invalid_request');
  const keys = body.events.map(usageEventKey_);
  if (new Set(keys).size !== keys.length) usageFail_('invalid_request');
  return keys;
}
function usageWithLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) usageFail_('unavailable');
  try { return fn(); } finally { lock.releaseLock(); }
}
function usageConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty('USAGE_SPREADSHEET_ID');
  const apiKey = properties.getProperty('USAGE_FIREBASE_WEB_API_KEY');
  if (properties.getProperty('USAGE_ENABLED') !== 'true' || !id || !apiKey) usageFail_('unavailable');
  return {id,apiKey};
}
// Global durable admission budget, not a user/session history. Consume BEFORE Google requests.
// Rejected authentications count too. Cache eviction cannot reset this limit.
function usageAdmit_() {
  usageWithLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const now = Date.now(), day = Utilities.formatDate(new Date(now),'Europe/Berlin','yyyy-MM-dd');
    const minute = Math.floor(now/60000);
    const raw = props.getProperty('USAGE_ADMISSION');
    const old = raw ? JSON.parse(raw) : {day,minute,dayCount:0,minuteCount:0};
    if (!Number.isSafeInteger(old.dayCount) || old.dayCount < 0 || !Number.isSafeInteger(old.minuteCount) || old.minuteCount < 0) usageFail_('unavailable');
    const state = {day,minute,dayCount:old.day === day ? old.dayCount : 0,minuteCount:old.minute === minute ? old.minuteCount : 0};
    if (state.minuteCount >= 30 || state.dayCount >= 3000) usageFail_('rate_limited');
    state.minuteCount++; state.dayCount++;
    props.setProperty('USAGE_ADMISSION',JSON.stringify(state));
  });
}
function usageTokenClaims_(idToken) {
  // This is ONLY an early rejection filter. It confers no trust or admin rights.
  if (typeof idToken !== 'string' || idToken.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)) usageFail_('unauthenticated');
  let header, claims;
  try {
    const parts=idToken.split('.');
    header=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  } catch (_) { usageFail_('unauthenticated'); }
  const now=Math.floor(Date.now()/1000);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid ||
      !claims || claims.aud !== USAGE_PROJECT_ || claims.iss !== 'https://securetoken.google.com/'+USAGE_PROJECT_ ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
      !Number.isSafeInteger(claims.iat) || claims.iat > now || claims.iat <= 0 ||
      !Number.isSafeInteger(claims.auth_time) || claims.auth_time > now || claims.auth_time <= 0 ||
      claims.auth_time > claims.iat || claims.exp <= claims.iat || claims.firebase?.tenant) usageFail_('unauthenticated');
  return claims;
}
function usageAuthenticate_(idToken, claims, apiKey) {
  // Google verifies the actual ID token, including its signature. No local decoded claim is trusted on its own.
  const response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(apiKey), {
    method:'post',contentType:'application/json',payload:JSON.stringify({idToken}),
    muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true
  });
  if (response.getResponseCode() !== 200) usageFail_('unauthenticated');
  const data=JSON.parse(response.getContentText());
  if (!Array.isArray(data.users) || data.users.length !== 1) usageFail_('unauthenticated');
  const user=data.users[0];
  const validSince=Number(user.validSince);
  if (user.localId !== claims.sub || user.emailVerified !== true || user.disabled === true || user.tenantId ||
      !Number.isSafeInteger(validSince) || validSince < 0 || claims.auth_time < validSince) usageFail_('unauthenticated');
  // Obtain CURRENT admin rights from authoritative account data, not caller input or a stale JWT claim.
  let attributes={};
  if (typeof user.customAttributes === 'string') attributes=JSON.parse(user.customAttributes);
  return {admin:attributes?.usageAdmin === true};
}
function usagePrivateFile_(id) {
  const active=SpreadsheetApp.getActiveSpreadsheet();
  if (active && active.getId() === id) usageFail_('unavailable');
  const file=DriveApp.getFileById(id), owner=file.getOwner();
  const effective=Session.getEffectiveUser().getEmail();
  if (!effective || !owner || owner.getEmail() !== effective || file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      file.getEditors().length || file.getViewers().length) usageFail_('unavailable');
  return file;
}
function usageSheet_(id) {
  usagePrivateFile_(id);
  const sheet=SpreadsheetApp.openById(id).getSheetByName('usageDaily');
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastRow() > 10001) usageFail_('unavailable');
  const header=sheet.getRange(1,1,1,2).getValues()[0];
  if (header[0] !== 'date' || header[1] !== 'counts') usageFail_('unavailable');
  return sheet;
}
function usageRows_(sheet) {
  const last=sheet.getLastRow();
  return last > 1 ? sheet.getRange(2,1,last-1,2).getValues() : [];
}
function usageCounts_(raw) {
  if (typeof raw !== 'string' || raw.length > 40000) usageFail_('unavailable');
  const counts=JSON.parse(raw);
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) usageFail_('unavailable');
  Object.keys(counts).forEach(key => {
    const parts=key.split('|');
    if (parts.length !== 3 || usageEventKey_({event:parts[0],subject:parts[1],area:parts[2]}) !== key ||
        !Number.isSafeInteger(counts[key]) || counts[key] < 0) usageFail_('unavailable');
  });
  return counts;
}
function usageDate_(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
function usageRecord_(id,keys) {
  return usageWithLock_(function () {
    const today=Utilities.formatDate(new Date(),'Europe/Berlin','yyyy-MM-dd');
    const sheet=usageSheet_(id), rows=usageRows_(sheet);
    const matches=rows.map((row,index)=>({row,index})).filter(item=>item.row[0] === today);
    if (matches.length > 1) usageFail_('unavailable');
    const counts=matches.length ? usageCounts_(matches[0].row[1]) : {};
    keys.forEach(key=>{const value=(counts[key]||0)+1;if(!Number.isSafeInteger(value))usageFail_('unavailable');counts[key]=value;});
    const row=matches.length ? matches[0].index+2 : sheet.getLastRow()+1;
    sheet.getRange(row,1,1,2).setNumberFormat('@').setValues([[today,JSON.stringify(counts)]]);
    SpreadsheetApp.flush(); // Persist before releasing lock; only one authoritative daily row changes.
    return {success:true};
  });
}
function usageRead_(id,period) {
  return usageWithLock_(function () {
    const today=Utilities.formatDate(new Date(),'Europe/Berlin','yyyy-MM-dd');
    const rows=usageRows_(usageSheet_(id)), byDay={}, totals={};
    rows.forEach(row=>{
      if (!usageDate_(row[0]) || row[0] > today || Object.prototype.hasOwnProperty.call(byDay,row[0])) usageFail_('unavailable');
      byDay[row[0]]=usageCounts_(row[1]);
    });
    let dates;
    if (period === 'all') dates=Object.keys(byDay).sort();
    else dates=Array.from({length:Number(period)},(_,i)=>new Date(Date.parse(today+'T00:00:00Z')-(Number(period)-1-i)*86400000).toISOString().slice(0,10));
    const days=dates.map(date=>({date,counts:byDay[date]||{}}));
    days.forEach(day=>Object.keys(day.counts).forEach(key=>{
      const total=(totals[key]||0)+day.counts[key];if(!Number.isSafeInteger(total))usageFail_('unavailable');totals[key]=total;
    }));
    return {success:true,data:{today,period,days,totals}};
  });
}
function usageHandle_(body) {
  try {
    const keys=usageValidate_(body), config=usageConfig_(), claims=usageTokenClaims_(body.idToken);
    usageAdmit_();
    const access=usageAuthenticate_(body.idToken,claims,config.apiKey);
    if (body.action === 'usageRead') {
      if (!access.admin) usageFail_('forbidden');
      return usageRead_(config.id,body.period);
    }
    return usageRecord_(config.id,keys);
  } catch (error) {
    const allowed=['invalid_request','unauthenticated','forbidden','rate_limited','unavailable'];
    return {success:false,error:allowed.includes(error?.usageCode) ? error.usageCode : 'unavailable'};
  }
}

// Apps Script hides trailing-underscore functions from the editor's Run menu.
// This visible entry is also callable through google.script.run, so enforce REAL Google identity
// against the bound workbook owner, not just effective-user equality (execute-as-caller exists).
function setupUsageStatistics() {
  const book=SpreadsheetApp.getActiveSpreadsheet();
  const owner=book && book.getOwner();
  const active=Session.getActiveUser().getEmail();
  const effective=Session.getEffectiveUser().getEmail();
  if (!owner || !active || active !== effective || active !== owner.getEmail()) usageFail_('forbidden');
  return setupUsageStatistics_();
}

// Run through the guarded editor entry above. Not routed through doGet/doPost.
// Creates a SEPARATE file; never inserts a statistics tab into the learning workbook.
// Leaves collection disabled until the owner completes deployment and acceptance.
function setupUsageStatistics_() {
  return usageWithLock_(function () {
    const props=PropertiesService.getScriptProperties();
    props.setProperty('USAGE_ENABLED','false');
    let id=props.getProperty('USAGE_SPREADSHEET_ID');
    if (!id) {
      const book=SpreadsheetApp.create('WiFa – private aggregierte Nutzungsstatistik');
      id=book.getId();
      // Save the ID before subsequent setup operations so retries do not create extra files.
      props.setProperty('USAGE_SPREADSHEET_ID',id);
      DriveApp.getFileById(id).setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
      const sheet=book.getSheets()[0];sheet.setName('usageDaily');
      sheet.getRange(1,1,1,2).setValues([['date','counts']]);
      sheet.setFrozenRows(1);SpreadsheetApp.flush();
    }
    usageSheet_(id); // Owner, sharing, separate file and schema checks must all pass.
    return 'Private Statistik vorbereitet. Sammlung bleibt deaktiviert.';
  });
}
