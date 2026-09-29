import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    let webView = WKWebView()
    let homeURL = URL(string: "https://tianji.matetechhk.com/")!
    let loadingView = UIView()
    let activityIndicator = UIActivityIndicatorView(style: .large)

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupLoadingView()
        loadHome()
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        webView.frame = view.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = UIColor(red: 0.10, green: 0.086, blue: 0.07, alpha: 1.0)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = "SuanLeMeApp/1.0 (iOS)"
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
        title.text = "算了么易学天机"
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

    private func loadHome() {
        let request = URLRequest(url: homeURL)
        webView.load(request)
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
        // 站内链接在 WebView 打开，站外（支付/电话/邮件）唤起系统
        if url.host == homeURL.host || url.host == "tianji.matetechhk.com" {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
        }
    }

    // MARK: - 支持 window.open（新窗口打开则当前页加载）
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
}