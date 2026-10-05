import UIKit
import WebKit
#if canImport(StoreKit)
import StoreKit
#endif

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    let webView = WKWebView()
    /// 本地游戏首页（App 内置，离线可玩）——不再加载远程网站
    let homeFileName = "home"
    let gamesSubdir = "Games"
    let loadingView = UIView()
    let activityIndicator = UIActivityIndicatorView(style: .large)

    // 允许站内跳转的远程域名（仅用于联网功能，如排行榜/账号；离线游戏不依赖）
    let allowedHosts: Set<String> = ["tianji.matetechhk.com"]

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupLoadingView()
        loadHome()
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

        webView.frame = view.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = UIColor(red: 0.10, green: 0.086, blue: 0.07, alpha: 1.0)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = "SuanLeMeApp/2.0 (iOS) wanleme"
        view.addSubview(webView)
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

    /// 加载 App 内置的本地游戏首页（离线可玩）
    private func loadHome() {
        guard let url = Bundle.main.url(forResource: homeFileName, withExtension: "html", subdirectory: gamesSubdir) else {
            // 兜底：直接找 bundle 根
            if let u = Bundle.main.url(forResource: homeFileName, withExtension: "html") {
                webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
                return
            }
            NSLog("[wanleme] 找不到内置 home.html")
            return
        }
        // 允许读取整个 Games 目录，保证本地相对跳转/资源可加载
        let dir = url.deletingLastPathComponent()
        webView.loadFileURL(url, allowingReadAccessTo: dir)
    }

    // MARK: - WKNavigationDelegate
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
            decisionHandler(.allow)
            return
        }
        // 站外（支付/电话/邮件/外部网页）唤起系统
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        decisionHandler(.cancel)
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

    // MARK: - IAP 桥（window.webkit.messageHandlers.iap）
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any] else { return }
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
