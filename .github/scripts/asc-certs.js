#!/usr/bin/env node
/* 用 App Store Connect API 盘点签名证书，清理「确定无用」的证书。

安全规则（三重条件，缺一不删）：
  1. certificateType 含 DEVELOPMENT
  2. displayName 为 "Created via API"（CI 自动创建，私钥留在临时 runner 上，已永久丢失）
  3. 没有任何 provisioning profile 引用它

DISTRIBUTION 证书一律不删（用于上架，且私钥可能在 Mac 上）。
环境变量 ASC_DRY=1 时只报告不删除。 */
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const KEY_PATH = process.env.ASC_KEY_PATH;
const KID = process.env.ASC_KEY_ID;
const ISS = process.env.ASC_ISSUER_ID;
const DRY = process.env.ASC_DRY === '1';

if (!KEY_PATH || !KID || !ISS) {
  console.log('::warning::缺少 ASC 凭据，跳过证书清理');
  process.exit(0);
}
if (!fs.existsSync(KEY_PATH)) {
  console.log('::warning::ASC 私钥文件不存在: ' + KEY_PATH);
  process.exit(0);
}

const b64u = (b) => Buffer.from(b).toString('base64url');

function makeJWT() {
  const key = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: KID, typ: 'JWT' };
  const payload = { iss: ISS, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' };
  const input = b64u(JSON.stringify(header)) + '.' + b64u(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return input + '.' + sig.toString('base64url');
}

function api(method, path, token) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com',
      path, method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let j = null;
        try { j = d ? JSON.parse(d) : {}; } catch (e) { j = { raw: d.slice(0, 200) }; }
        resolve({ status: res.statusCode, body: j });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: { err: String(e.message) } }));
    req.setTimeout(30000, () => { req.destroy(); });
    req.end();
  });
}

(async () => {
  const token = makeJWT();
  const now = Date.now();

  // ---- 1. 证书 ----
  const rc = await api('GET', '/v1/certificates?limit=200', token);
  if (rc.status !== 200) {
    console.log('::warning::证书接口 HTTP ' + rc.status + ' ' + JSON.stringify(rc.body).slice(0, 200));
    process.exit(0);
  }
  const certs = (rc.body.data || []).map((c) => {
    const a = c.attributes || {};
    const exp = a.expirationDate ? Date.parse(a.expirationDate) : 0;
    return {
      id: c.id,
      type: a.certificateType || '?',
      name: a.displayName || a.name || '(none)',
      exp: (a.expirationDate || '').slice(0, 10),
      expired: exp > 0 && exp < now,
    };
  });
  console.log('证书总数: ' + certs.length);
  certs.forEach((x, i) => console.log('  ' + (i + 1) + '. [' + x.type + '] ' + x.name + ' exp=' + x.exp + (x.expired ? ' 已过期' : '')));

  // ---- 2. 全部描述文件引用的证书 ----
  const rp = await api('GET', '/v1/profiles?limit=200', token);
  const profiles = (rp.body && rp.body.data) || [];
  console.log('描述文件数: ' + profiles.length);

  const used = new Set();
  for (const p of profiles) {
    const r = await api('GET', '/v1/profiles/' + p.id + '/certificates?limit=50', token);
    const list = (r.body && r.body.data) || [];
    list.forEach((c) => used.add(c.id));
    const pa = p.attributes || {};
    console.log('  profile ' + (pa.name || p.id) + ' -> 引用证书 ' + list.length + ' 张');
  }
  console.log('被引用证书合计: ' + used.size + ' 张');

  // ---- 3. 判定可删 ----
  const targets = certs.filter((x) =>
    /DEVELOPMENT/i.test(x.type) &&
    /created via api/i.test(x.name) &&
    !used.has(x.id)
  );

  console.log('可安全删除（DEVELOPMENT + Created via API + 无 profile 引用）: ' + targets.length + ' 张');
  targets.forEach((x) => console.log('  -> ' + x.name + ' ' + x.id + ' exp=' + x.exp));

  if (DRY) {
    console.log('ASC_DRY=1，仅报告不删除');
    process.exit(0);
  }

  let ok = 0;
  for (const t of targets) {
    const d = await api('DELETE', '/v1/certificates/' + t.id, token);
    if (d.status === 204 || d.status === 200) { ok++; console.log('  已删除 ' + t.name); }
    else { console.log('::warning::删除失败 ' + t.name + ' HTTP ' + d.status + ' ' + JSON.stringify(d.body).slice(0, 120)); }
  }
  console.log('本次删除 ' + ok + ' 张');

  // ---- 4. 复查 ----
  const r2 = await api('GET', '/v1/certificates?limit=200', token);
  const left = (r2.body && r2.body.data) || [];
  const devLeft = left.filter((c) => /DEVELOPMENT/i.test((c.attributes || {}).certificateType || '')).length;
  const distLeft = left.filter((c) => /DISTRIBUTION/i.test((c.attributes || {}).certificateType || '')).length;
  console.log('清理后：共 ' + left.length + ' 张（DEVELOPMENT ' + devLeft + ' / DISTRIBUTION ' + distLeft + '）');

  if (ok > 0) console.log('::notice::已释放 ' + ok + ' 个证书名额，后续 Archive 可重新申请证书');
  else if (targets.length === 0) console.log('::warning::没有可自动清理的无用证书；若仍报上限，需人工吊销一张分发证书');
})();
