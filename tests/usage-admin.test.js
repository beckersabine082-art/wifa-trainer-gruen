const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('admin grant/revoke preserves unrelated claims and requires an eligible account',async()=>{
  assert.ok(fs.existsSync('tools/usage-admin.cjs'),'admin setup helper must exist');
  const {setUsageAdmin}=require('../tools/usage-admin.cjs');
  let saved;
  const auth={getUser:async()=>({emailVerified:true,disabled:false,customClaims:{otherRole:'teacher'}}),setCustomUserClaims:async(uid,claims)=>{saved={uid,claims};}};
  await setUsageAdmin(auth,'admin-uid',true);
  assert.deepEqual(saved,{uid:'admin-uid',claims:{otherRole:'teacher',usageAdmin:true}});
  auth.getUser=async()=>({emailVerified:true,customClaims:{otherRole:'teacher',usageAdmin:true}});
  await setUsageAdmin(auth,'admin-uid',false);assert.deepEqual(saved.claims,{otherRole:'teacher'});
  auth.getUser=async()=>({emailVerified:false});await assert.rejects(()=>setUsageAdmin(auth,'admin-uid',true));
  auth.getUser=async()=>({emailVerified:true,disabled:true});await assert.rejects(()=>setUsageAdmin(auth,'admin-uid',true));
});
