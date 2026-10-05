import Foundation
import StoreKit

/// StoreKit 2 内购管理器
/// 与网页层通过 WKScriptMessageHandler(name = "iap") 通信：
///   window.iap.products([...])         → 查询商品
///   window.iap.purchase("productId")   → 发起购买，成功后把 Apple 的 JWS 回执交给网页去服务端校验发货
///   window.iap.restore()               → 恢复购买
@available(iOS 15.0, *)
final class IAPManager {

    static let shared = IAPManager()
    private var updatesTask: Task<Void, Never>?

    private init() {}

    /// 监听交易更新（App 外完成、订阅续费、家人共享等）
    func startObserving() {
        guard updatesTask == nil else { return }
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self = self else { continue }
                if case .verified(let transaction) = result {
                    // 交给服务端校验（网页层在下次轮询/启动时会核对），这里仅结束交易
                    await transaction.finish()
                    _ = transaction
                }
            }
        }
    }

    /// 查询商品
    func loadProducts(ids: [String]) async -> [[String: Any]] {
        do {
            let products = try await Product.products(for: ids)
            return products.map { p in
                [
                    "id": p.id,
                    "displayName": p.displayName,
                    "description": p.description,
                    "displayPrice": p.displayPrice,
                    "price": NSDecimalNumber(decimal: p.price).doubleValue,
                    "currencyCode": p.priceFormatStyle.currencyCode,
                    "type": "\(p.type)"
                ]
            }
        } catch {
            return []
        }
    }

    /// 发起购买。成功返回 Apple 签名的 JWS（jwsRepresentation），由网页交服务端校验。
    /// 返回字典：{ "status": "success|userCancelled|pending|error", "jws": "...", "productId": "...", "error": "..." }
    func purchase(productId: String) async -> [String: Any] {
        do {
            let products = try await Product.products(for: [productId])
            guard let product = products.first else {
                return ["status": "error", "error": "PRODUCT_NOT_FOUND"]
            }
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    let jws = verification.jwsRepresentation
                    await transaction.finish()
                    return ["status": "success", "jws": jws,
                            "productId": transaction.productID,
                            "transactionId": String(transaction.id)]
                case .unverified(_, let error):
                    return ["status": "error", "error": "UNVERIFIED: \(error.localizedDescription)"]
                }
            case .userCancelled:
                return ["status": "userCancelled"]
            case .pending:
                return ["status": "pending"]
            @unknown default:
                return ["status": "error", "error": "UNKNOWN"]
            }
        } catch {
            return ["status": "error", "error": error.localizedDescription]
        }
    }

    /// 恢复购买：返回当前所有有效交易的 JWS 列表
    func restore() async -> [[String: Any]] {
        var out: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                out.append([
                    "productId": transaction.productID,
                    "transactionId": String(transaction.id),
                    "originalId": String(transaction.originalID)
                ])
                _ = transaction
            }
        }
        return out
    }
}
