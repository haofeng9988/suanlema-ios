import UIKit
import WebKit
import Photos
#if canImport(StoreKit)
import StoreKit
#endif

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    /// 必须在 setupWebView() 中用带 config 的方式创建：
    /// 原先写成 `WKWebView()`，导致 userContentController / 注入脚本全部未生效，
    /// 表现为登录接口 404/403、内购桥失效。
    var webView: WKWebView!
    /// 远程主站（仅用于用户主动点击的联网功能：登录/商城/排行/会员）
    /// 注意：启动时不加载它。首屏必须是内置本地游戏页，否则会被判 4.2 套壳网站。
    let remoteHomeURL = "https://tianji.matetechhk.com/xuetang"
    /// 首屏：App 内置的 1.9.2 原稿页面（与线上 /xuetang 逐字节一致）
    /// 不再使用手写仿制页；图标/布局/文案全部来自生产模板本身。
    let homeFileName = "index"
    let gamesSubdir = "Games/xt192"
    /// 原生接口转发目标（页面 file:// 下 Origin=null 会被生产 CORS 拒绝，故由原生代发）
    let apiBase = "https://tianji.matetechhk.com"
    let loadingView = UIView()
    let activityIndicator = UIActivityIndicatorView(style: .large)

    // 允许站内跳转的远程域名（仅用于联网功能，如排行榜/账号；离线游戏不依赖）
    let allowedHosts: Set<String> = ["tianji.matetechhk.com"]

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupLoadingView()
        loadStart()
        if #available(iOS 15.0, *) {
            IAPManager.shared.startObserving()
        }
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        // IAP 桥：网页通过 window.webkit.messageHandlers.iap.postMessage(...) 调用原生内购
        config.userContentController.add(self, name: "iap")
        // 接口桥：把页面里 fetch('/api/...') 转发给原生 URLSession，绕开 file:// 的 CORS 403
        config.userContentController.add(self, name: "api")
        // 媒体桥：为 iOS 补上 AndroidApp.saveImage / shareImage 同签名接口，
        // 保存海报交给原生相册写入，避免 WebView 处理 data: 大图导致闪退
        config.userContentController.add(self, name: "media")
        config.userContentController.addUserScript(WKUserScript(source: Self.mediaShimJS,
                                                               injectionTime: .atDocumentStart,
                                                               forMainFrameOnly: false))
        // 兼容修补：只对线上页面生效（内置首页除外），修生产页面自身的缺陷，不改服务器
        config.userContentController.addUserScript(WKUserScript(source: Self.sitePatchCSSJS,
                                                               injectionTime: .atDocumentEnd,
                                                               forMainFrameOnly: true))
        config.userContentController.addUserScript(WKUserScript(source: Self.apiShimJS,
                                                               injectionTime: .atDocumentStart,
                                                               forMainFrameOnly: false))

        // 安全区：webView 顶部锚定 safeAreaLayoutGuide，全站统一让出刘海/动态岛/状态栏高度。
        // 原先 frame = view.bounds 让网页铺满全屏，是否被遮挡取决于各页 CSS 有没有写
        // env(safe-area-inset-top)；实测 millionaire.html 顶部只有 padding-top:10px，
        // 标题和返回按钮直接顶进前置镜头区域。改由客户端统一处理，避免逐页修改。
        view.backgroundColor = UIColor(red: 0.10, green: 0.086, blue: 0.07, alpha: 1.0)
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = UIColor(red: 0.10, green: 0.086, blue: 0.07, alpha: 1.0)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = "SuanLeMeApp/2.1 (iOS) wanleme"
        view.addSubview(webView)

        // 顶部让出安全区；底部仍铺到屏幕底，保留各页 env(safe-area-inset-bottom) 的原有行为。
        let constraints: [NSLayoutConstraint] = [
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ]
        NSLayoutConstraint.activate(constraints)
    }

    /// 安全区发生变化（旋转、来电、动态岛状态切换）时重新布局，避免顶部间距失效。
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        view.setNeedsLayout()
    }

    private func setupLoadingView() {
        loadingView.frame = view.bounds
        loadingView.backgroundColor = UIColor(red: 0.10, green: 0.086, blue: 0.07, alpha: 1.0)
        loadingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let logo = UIImageView(image: UIImage(named: "splash_logo"))
        logo.contentMode = .scaleAspectFit
        logo.frame = CGRect(x: 0, y: 0, width: 120, height: 120)
        logo.center = CGPoint(x: view.center.x, y: view.center.y - 40)

        let title = UILabel()
        title.text = "算了吗·易游"
        title.textColor = UIColor(red: 0.83, green: 0.69, blue: 0.22, alpha: 1.0)
        title.font = UIFont.boldSystemFont(ofSize: 22)
        title.sizeToFit()
        title.center = CGPoint(x: view.center.x, y: view.center.y + 50)

        activityIndicator.color = .white
        activityIndicator.center = CGPoint(x: view.center.x, y: view.center.y + 110)

        loadingView.addSubview(logo)
        loadingView.addSubview(title)
        loadingView.addSubview(activityIndicator)
        view.addSubview(loadingView)
        activityIndicator.startAnimating()
    }

    /// 启动：直接加载 App 内置的本地游戏首页（与已过审的 2.0 一致）
    /// 4.2 说明：首屏为本地 file:// 内容，六款游戏离线可玩，不依赖任何服务器。
    /// 远程站点仅在用户主动点击联网功能时打开（见 allowedHosts 白名单）。
    private func loadStart() {
        loadLocalHome()
    }

    /// 加载 App 内置的本地游戏首页（离线可玩）
    private func loadLocalHome() {
        guard let url = Bundle.main.url(forResource: homeFileName, withExtension: "html", subdirectory: gamesSubdir) else {
            // 兜底 1：旧的仿制首页（仅在 xt192 丢失时使用，避免白屏）
            if let u = Bundle.main.url(forResource: "home", withExtension: "html", subdirectory: "Games") {
                webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
                return
            }
            // 兜底 2：bundle 根
            if let u = Bundle.main.url(forResource: homeFileName, withExtension: "html") {
                webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
                return
            }
            NSLog("[wanleme] 找不到内置首页 index.html")
            return
        }
        // 授权整个 Games 目录（而非仅 xt192 子目录）：
        // 首页在 Games/xt192/，充值/会员页在上一层 Games/vip.html，
        // 若只授权 xt192，跳 ../vip.html 会越权失败 → 触发 didFailProvisionalNavigation
        // 兜底回首页，表现为「点充值/会员中心跳到游戏主页」。
        // 向上取到 Games/（含 xt192、tool-icons、vip.html 等全部本地资源）。
        var dir = url.deletingLastPathComponent()          // Games/xt192
        if dir.lastPathComponent == "xt192" {
            dir = dir.deletingLastPathComponent()          // Games
        }
        webView.loadFileURL(url, allowingReadAccessTo: dir)
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavFailure(error)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleNavFailure(error)
    }

    /// 导航失败统一处理：本地页面失败不再静默回首页。
    /// 原逻辑无差别 loadLocalHome()，于是「充值 / 会员中心」一旦导航失败，
    /// 用户看到的就是游戏主页，误判为入口被重定向。
    private func handleNavFailure(_ error: Error) {
        let ns = error as NSError
        // 主动取消（decidePolicy 拦截、重定向）不算失败
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        let current = webView.url
        // 远程站点不可用（断网/服务异常）→ 回本地首页，保证离线可玩
        if current?.isFileURL == false {
            loadLocalHome()
            return
        }
        // 本地页面导航失败：留在当前页 + 明确提示，绝不静默跳回游戏主页
        NSLog("[wanleme] 本地导航失败: \(ns.code) \(ns.localizedDescription) url=\(current?.absoluteString ?? "-")")
        showNavFailureTip()
    }

    private func showNavFailureTip() {
        let js = """
        (function(){
          try{
            var old=document.getElementById('__navfail'); if(old) old.remove();
            var d=document.createElement('div');
            d.id='__navfail';
            d.textContent='页面打开失败，请重试';
            d.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);'+
              'background:rgba(0,0,0,.88);color:#f5d06f;padding:14px 20px;border-radius:12px;'+
              'font-size:15px;z-index:2147483647;border:1px solid rgba(212,175,55,.55);'+
              'box-shadow:0 8px 28px rgba(0,0,0,.6)';
            (document.body||document.documentElement).appendChild(d);
            setTimeout(function(){ if(d&&d.parentNode) d.parentNode.removeChild(d); },2600);
          }catch(e){}
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        UIView.animate(withDuration: 0.4) {
            self.loadingView.alpha = 0
        } completion: { _ in
            self.loadingView.isHidden = true
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        // 本地文件（App 内置游戏）直接放行
        if url.isFileURL {
            decisionHandler(.allow)
            return
        }
        // 站内远程域名（联网功能：排行榜/账号等）在 WebView 打开
        if let host = url.host, allowedHosts.contains(host) {
            // Apple 3.1.1：App 内不得出现网页现金/充值入口。
            // 线上页面（如内置页链接、用户从其它页面点进来）的 /pay/* 统一拦下，
            // 改写为加载 App 内置内购页 vip.html，确保数字商品只走 StoreKit。
            let path = url.path
            if path.hasPrefix("/pay/") {
                decisionHandler(.cancel)
                loadBundledIAPPage()
                return
            }
            decisionHandler(.allow)
            return
        }
        // 站外（支付/电话/邮件/外部网页）唤起系统
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        decisionHandler(.cancel)
    }

    /// 加载 App 内置内购页（3.1.1：替代网页充值入口）
    private func loadBundledIAPPage() {
        guard let u = Bundle.main.url(forResource: "vip", withExtension: "html", subdirectory: "Games") else {
            NSLog("[wanleme] 找不到内置 vip.html")
            return
        }
        webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
    }

    // MARK: - 支持 window.open（新窗口打开则当前页加载）
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    // MARK: - WKUIDelegate: 显示 JS alert（WKWebView 默认不弹窗，必须实现）
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in
            completionHandler()
        })
        presentOnTop(alert)
    }

    // MARK: - WKUIDelegate: 显示 JS confirm
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in
            completionHandler(true)
        })
        presentOnTop(alert)
    }

    // MARK: - WKUIDelegate: 显示 JS prompt（输入框）
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { tf in
            tf.text = defaultText
        }
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in
            completionHandler(nil)
        })
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        presentOnTop(alert)
    }

    // 在顶层控制器上呈现（避免 "whose view is not in the window hierarchy" / already presenting 报错）
    private func presentOnTop(_ vc: UIViewController) {
        var top: UIViewController = self
        while let presented = top.presentedViewController {
            top = presented
        }
        if top is UIAlertController {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                self?.presentOnTop(vc)
            }
            return
        }
        top.present(vc, animated: true, completion: nil)
    }

    // MARK: - 兼容修补：修生产页面自身的适配缺陷（仅在 App 内生效，不改服务器代码）
    /// 1) 灵田天机底部「仓库/商店/偷菜」在短屏被裁：线上用 position:relative + margin-top:-14px，
    ///    父级 .canvas-wrap 高度 100vh 且 overflow:hidden，底栏被推出视口外（已实测：iPhone SE 被裁 38px）。
    ///    App 内改为固定在安全区内。
    /// 2) 游戏页返回按钮热区仅 49x23，不足 44x44，改为扩大热区（不改位置与文案）。
    private static let sitePatchCSSJS = """
    (function(){
      try {
        var host = (location.host || '');
        if (host.indexOf('tianji.matetechhk.com') < 0) return;   // 仅线上页面
        var css = ''
          + '.lt5-plates{position:fixed !important;left:auto !important;right:12px !important;'
          + 'bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important;'
          + 'margin-top:0 !important;z-index:20 !important}'
          + 'a[href*="#tianji"]{display:inline-flex !important;align-items:center !important;'
          + 'min-height:44px !important;min-width:44px !important;padding:0 10px !important;margin:-10px 0 !important}';
        var st = document.createElement('style');
        st.id = '__ios_site_patch';
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
      } catch(e){}
    })();
    """

    // MARK: - 媒体桥：iOS 实现 AndroidApp 同签名（saveImage / shareImage / getBridgeVersion）
    private static let mediaShimJS = """
    (function(){
      if (window.AndroidApp) return;
      function post(p){ try { window.webkit.messageHandlers.media.postMessage(p); } catch(e){} }
      window.AndroidApp = {
        getBridgeVersion: function(){ return 3; },
        saveImage: function(dataUri, name){ post({action:'saveImage', dataUri:String(dataUri||''), name:String(name||'')}); },
        shareImage: function(dataUri, name){ post({action:'shareImage', dataUri:String(dataUri||''), name:String(name||'')}); }
      };
    })();
    """

    private func imageFromDataUri(_ uri: String) -> UIImage? {
        guard let comma = uri.firstIndex(of: ",") else { return nil }
        let b64 = String(uri[uri.index(after: comma)...])
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { return nil }
        return UIImage(data: data)
    }

    private func handleMedia(_ dict: [String: Any]) {
        let action = (dict["action"] as? String) ?? ""
        let dataUri = (dict["dataUri"] as? String) ?? ""
        let name = (dict["name"] as? String) ?? ""
        switch action {
        case "saveImage": saveImageToAlbum(dataUri, name: name)
        case "shareImage": shareImageNative(dataUri, name: name)
        default: break
        }
    }

    private func saveImageToAlbum(_ dataUri: String, name: String) {
        guard let img = imageFromDataUri(dataUri) else {
            showToast("海报保存失败：图片解析异常")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            guard let self = self else { return }
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async { self.showToast("请在系统设置中允许「算了吗·易游」保存图片") }
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: img)
            }) { ok, err in
                DispatchQueue.main.async {
                    self.showToast(ok ? "已保存到相册" : "保存失败：\(err?.localizedDescription ?? "未知错误")")
                }
            }
        }
    }

    private func shareImageNative(_ dataUri: String, name: String) {
        guard let img = imageFromDataUri(dataUri) else {
            showToast("海报分享失败：图片解析异常")
            return
        }
        let vc = UIActivityViewController(activityItems: [img], applicationActivities: nil)
        presentOnTop(vc)
    }

    private func showToast(_ text: String) {
        let alert = UIAlertController(title: nil, message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default))
        presentOnTop(alert)
    }

    // MARK: - 接口桥：window.fetch('/api/...') -> 原生 URLSession -> 回填 Response
    private static let apiShimJS = """
    (function(){
      if (window.__apiBridgeInstalled) return;
      window.__apiBridgeInstalled = true;
      var pending = {}, seq = 0;
      window.__apiCallback = function(id, status, body){
        var cb = pending[id]; if(!cb) return; delete pending[id];
        var st = status || 200;
        try { cb(new Response(body, {status: st, headers: {'Content-Type':'application/json; charset=utf-8'}})); }
        catch(e){ try{ cb(new Response(body, {status: 200})); }catch(e2){} }
      };
      function originPrefix(u){
        try { if (location.origin && u.indexOf(location.origin) === 0) return location.origin; } catch(e){}
        return '';
      }
      function toApiPath(u){
        try {
          var p = originPrefix(u);
          if (p && u.indexOf(p) === 0) u = u.slice(p.length);
          if (location.protocol === 'file:') {
            var abs = 'https://tianji.matetechhk.com';
            if (u.indexOf(abs) === 0) u = u.slice(abs.length);
          }
        } catch(e){}
        return u;
      }
      function shouldBridge(u){
        try {
          if (typeof u !== 'string') return false;
          var q = toApiPath(u);
          return q.indexOf('/api/') === 0;
        } catch(e){ return false; }
      }
      var origFetch = window.fetch ? window.fetch.bind(window) : null;
      window.fetch = function(input, init){
        init = init || {};
        var url = (typeof input === 'string') ? input : ((input && input.url) || '');
        if (!shouldBridge(url)) {
          if (origFetch) return origFetch(input, init);
          return Promise.reject(new Error('fetch unavailable'));
        }
        var path = toApiPath(url);
        var headers = {};
        try {
          if (init.headers) {
            if (typeof init.headers.forEach === 'function' && !Array.isArray(init.headers)) {
              init.headers.forEach(function(v,k){ headers[k] = v; });
            } else { for (var k in init.headers) headers[k] = init.headers[k]; }
          }
        } catch(e){}
        var bodyStr = null;
        if (init.body !== null && init.body !== undefined && typeof init.body === 'string') bodyStr = init.body;
        var id = 'r' + (++seq);
        return new Promise(function(resolve, reject){
          pending[id] = resolve;
          try {
            window.webkit.messageHandlers.api.postMessage({
              id: id, path: path, method: (init.method || 'GET'), headers: headers, body: bodyStr
            });
          } catch(e){ delete pending[id]; reject(e); return; }
          setTimeout(function(){ if (pending[id]) { delete pending[id]; reject(new Error('API_TIMEOUT')); } }, 30000);
        });
      };
    })();
    """

    private func handleAPIRequest(_ dict: [String: Any]) {
        let id = (dict["id"] as? String) ?? ""
        let path = (dict["path"] as? String) ?? ""
        let method = ((dict["method"] as? String) ?? "GET").uppercased()
        let headers = (dict["headers"] as? [String: String]) ?? [:]
        let body = dict["body"] as? String
        guard !path.isEmpty, let url = URL(string: apiBase + path) else { return }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 25
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        // 以站内来源发送，保证生产端 CORS/鉴权判断与浏览器一致
        req.setValue(apiBase, forHTTPHeaderField: "Origin")
        req.setValue(apiBase + "/", forHTTPHeaderField: "Referer")
        if let body = body, !body.isEmpty {
            req.httpBody = body.data(using: .utf8)
            if req.value(forHTTPHeaderField: "Content-Type") == nil {
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            }
        }

        URLSession.shared.dataTask(with: req) { [weak self] data, resp, err in
            guard let self = self else { return }
            let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if let err = err {
                self.replyAPI(id, status: 0, body: "{\"ok\":false,\"error\":\"\(err.localizedDescription)\"}")
                return
            }
            let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            self.replyAPI(id, status: status, body: text)
        }.resume()
    }

    private func replyAPI(_ id: String, status: Int, body: String) {
        guard !id.isEmpty else { return }
        DispatchQueue.main.async {
            let js = "window.__apiCallback && window.__apiCallback(\(self.jsString(id)), \(status), \(self.jsString(body)))"
            self.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - IAP 桥（window.webkit.messageHandlers.iap）
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any] else { return }
        if message.name == "api" {
            handleAPIRequest(dict)
            return
        }
        if message.name == "media" {
            handleMedia(dict)
            return
        }
        let action = (dict["action"] as? String) ?? ""
        let callbackId = (dict["callbackId"] as? String) ?? ""

        if #unavailable(iOS 15.0) {
            replyIAP(callbackId, ["status": "error", "error": "IOS_TOO_OLD"])
            return
        }

        switch action {
        case "products":
            let ids = (dict["ids"] as? [String]) ?? []
            Task { @MainActor in
                let list = await IAPManager.shared.loadProducts(ids: ids)
                self.replyIAP(callbackId, ["status": "success", "products": list])
            }
        case "purchase":
            let pid = (dict["productId"] as? String) ?? ""
            Task { @MainActor in
                let res = await IAPManager.shared.purchase(productId: pid)
                self.replyIAP(callbackId, res)
            }
        case "restore":
            Task { @MainActor in
                let list = await IAPManager.shared.restore()
                self.replyIAP(callbackId, ["status": "success", "entitlements": list])
            }
        default:
            replyIAP(callbackId, ["status": "error", "error": "UNKNOWN_ACTION"])
        }
    }

    private func replyIAP(_ callbackId: String, _ payload: [String: Any]) {
        guard !callbackId.isEmpty else { return }
        let data = try? JSONSerialization.data(withJSONObject: payload, options: [])
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        DispatchQueue.main.async {
            let js = "window.__iapCallback && window.__iapCallback(\(self.jsString(callbackId)), \(self.jsString(json)))"
            self.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func jsString(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s], options: [])
        var str = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        if str.hasPrefix("[") && str.hasSuffix("]") {
            str = String(str.dropFirst().dropLast())
        }
        return str
    }
}
