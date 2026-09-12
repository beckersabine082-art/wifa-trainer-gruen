#!/usr/bin/env node
'use strict';
// Local trusted setup only. Never imported by the website; never stores account identifiers.
async function setUsageAdmin(auth, uid, enabled) {
  if(typeof uid !== 'string' || !uid.trim() || uid.length>128 || typeof enabled !== 'boolean') throw Error('invalid_argument');
  const account=await auth.getUser(uid);
  if(enabled && (account.disabled || account.emailVerified !== true)) throw Error('ineligible_account');
  const claims={...(account.customClaims||{})};
  if(enabled) claims.usageAdmin=true; else delete claims.usageAdmin;
  await auth.setCustomUserClaims(uid,claims);
}
async function main() {
  const [action,uid,...extra]=process.argv.slice(2);
  if(!['grant','revoke','check'].includes(action)||!uid||extra.length) {
    console.error('Aufruf: node tools/usage-admin.cjs grant|revoke|check <Firebase-UID>');process.exitCode=1;return;
  }
  const {createRequire}=require('node:module');
  const path=require('node:path');
  const adminRequire=createRequire(path.join(__dirname,'podcast-sync','package.json'));
  const {initializeApp,applicationDefault}=adminRequire('firebase-admin/app');
  const {getAuth}=adminRequire('firebase-admin/auth');
  const app=initializeApp({credential:applicationDefault(),projectId:'wifa-trainer-gruen'});
  const auth=getAuth(app);
  if(action==='check') {
    const account=await auth.getUser(uid);
    console.log(account.customClaims?.usageAdmin === true ? 'Statistik-Adminrecht vorhanden.' : 'Kein Statistik-Adminrecht.');
  } else {
    await setUsageAdmin(auth,uid,action==='grant');
    console.log(action==='grant' ? 'Statistik-Adminrecht gesetzt. Erneut anmelden.' : 'Statistik-Adminrecht entfernt.');
  }
}
if(require.main===module) main().catch(()=>{
  // SDK errors may contain account identifiers. Deliberately do not print the error object.
  console.error('Einrichtung fehlgeschlagen. Abhängigkeiten, Google-Anmeldedaten, Projektberechtigung und bestätigtes Konto prüfen.');
  process.exitCode=1;
});
module.exports={setUsageAdmin};
