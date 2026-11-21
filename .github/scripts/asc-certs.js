#!/usr/bin/env node
/* 用 App Store Connect API 盘点签名证书，并自动清理「已过期」证书。
   只删除 expirationDate < 当前时间 的证书——过期证书本身已不可用，删除无副作用。
   未过期但未被任何 profile 引用的，仅报告，不删除（需人工确认）。 */
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const KEY_PATH = process.env.ASC_KEY_PATH;
const KID = process.env.ASC_KEY_ID;
const ISS = process.env.ASC_ISSUER_ID;

if (!KEY_PATH || !KID || !ISS) {
  console.log('::warning::缺少 ASC 凭据，跳过证书清理');
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
        try { j = JSON.parse(d); } catch (e) { j = { raw: d.slice(0, 200) }; }
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

  // 1. 盘点证书
  const r1 = await api('GET', '/v1/certificates?limit=200', token);
  if (r1.status !== 200) {
    console.log('::warning::证书接口返回 ' + r1.status + ' ' + JSON.stringify(r1.body).slice(0, 160));
    process.exit(0);
  }
  const certs = r1.body.data || [];
  console.log('证书总数: ' + certs.length);

  const rows = certs.map((c) => {
    const a = c.attributes || {};
    const exp = a.expirationDate ? Date.parse(a.expirationDate) : 0;
    return {
      id: c.id,
      type: a.certificateType || '?',
      name: a.displayName || a.name || '(no name)',
      exp: a.expirationDate || '',
      expired: exp > 0 && exp < now,
    };
  });

  const dist = rows.filter((x) => /DISTRIBUTION/.test(x.type));
  console.log('其中分发证书: ' + dist.length);
  rows.forEach((x) => {
    console.log('  [' + x.type + '] ' + x.name + '  exp=' + x.exp + (x.expired ? '  <<已过期' : ''));
  });

  // 2. 只删已过期的
  const dead = rows.filter((x) => x.expired);
  let deleted = 0;
  for (const c of dead) {
    const d = await api('DELETE', '/v1/certificates/' + c.id, token);
    if (d.status === 204 || d.status === 200) { deleted++; }
    else { console.log('::warning::删除失败 ' + c.name + ' HTTP ' + d.status); }
  }
  if (deleted > 0) console.log('已删除过期证书: ' + deleted + ' 张');

  // 3. 复查剩余
  const r2 = await api('GET', '/v1/certificates?limit=200', token);
  const left = (r2.body && r2.body.data) || [];
  const distLeft = left.filter((c) => /DISTRIBUTION/.test((c.attributes || {}).certificateType || ''));
  console.log('清理后：证书 ' + left.length + ' 张，其中分发证书 ' + distLeft.length + ' 张');

  // 4. 汇总成注解（公开可读）
  const alive = rows.filter((x) => !x.expired);
  alive.slice(0, 8).forEach((x, i) => {
    console.log('::warning::现存证书' + (i + 1) + ' ' + x.type + ' | ' + x.name + ' | 到期 ' + x.exp.slice(0, 10));
  });
  if (deleted === 0) {
    console.log('::warning::没有可自动清理的过期证书；若仍报证书上限，需人工吊销一张不用的分发证书');
  }
})();
