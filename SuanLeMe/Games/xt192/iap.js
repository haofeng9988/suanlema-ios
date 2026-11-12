/* 算了吗 · Apple 内购桥 iap.js
 * 作用：网页端调用 iOS 原生 StoreKit（通过 window.webkit.messageHandlers.iap）。
 * 仅当在 iOS App 内（UA 含 SuanLeMeApp）且原生桥存在时生效；普通浏览器/安卓回退到旧逻辑。
 */
(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isIOSApp = ua.indexOf('SuanLeMeApp/') >= 0 && /(iPhone|iPad|iPod|iOS)/i.test(ua);
  var hasBridge = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iap);

  window.IAP = {
    available: isIOSApp && hasBridge,

    /** 查询商品：IAP.products(['id1','id2']).then(list=>...) */
    products: function (ids) {
      if (!window.IAP.available) return Promise.resolve([]);
      return call({ action: 'products', ids: ids || [] }).then(function (r) {
        return (r && r.products) || [];
      });
    },

    /** 发起购买：IAP.purchase('productId').then(res=>{status,jws,productId}) */
    purchase: function (productId) {
      if (!window.IAP.available) return Promise.resolve({ status: 'not_available' });
      return call({ action: 'purchase', productId: productId });
    },

    /** 恢复购买：IAP.restore().then(list=>...) */
    restore: function () {
      if (!window.IAP.available) return Promise.resolve([]);
      return call({ action: 'restore' }).then(function (r) {
        return (r && r.entitlements) || [];
      });
    },

    /**
     * 一站式：买 → 校验 → 发货。
     * productId 为 Apple 产品 ID；成功后调用后端 /api/iap/verify 验单发货。
     * 返回 { ok:bool, msg:string, data:any }
     */
    buy: function (productId) {
      return window.IAP.purchase(productId).then(function (res) {
        if (!res || res.status !== 'success' || !res.jws) {
          var s = (res && res.status) || 'error';
          if (s === 'userCancelled') return { ok: false, msg: '已取消' };
          if (s === 'pending') return { ok: false, msg: '购买待处理（可能需要家长批准）' };
          return { ok: false, msg: '购买失败：' + ((res && res.error) || s) };
        }
        // 把 Apple 签名的 JWS 回执交服务端校验并发货
        return fetch('/api/iap/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Token': (window.TOKEN || localStorage.getItem('yx_tk') || '') },
          body: JSON.stringify({ jws: res.jws, product_id: productId })
        }).then(function (r) { return r.json(); }).then(function (j) {
          return j || { ok: false, msg: '校验失败' };
        });
      });
    }
  };

  // 原生回调入口
  window.__iapCallback = function (callbackId, json) {
    var cb = _pending[callbackId];
    if (!cb) return;
    delete _pending[callbackId];
    var data = {};
    try { data = JSON.parse(json); } catch (e) {}
    cb(data);
  };

  var _pending = {};
  var _seq = 0;
  function call(payload) {
    return new Promise(function (resolve, reject) {
      var id = 'cb' + (++_seq) + '_' + Date.now();
      _pending[id] = resolve;
      payload.callbackId = id;
      try {
        window.webkit.messageHandlers.iap.postMessage(payload);
      } catch (e) {
        delete _pending[id];
        reject(e);
      }
      // 超时保护（60s）
      setTimeout(function () {
        if (_pending[id]) { delete _pending[id]; resolve({ status: 'timeout' }); }
      }, 60000);
    });
  }
})();
