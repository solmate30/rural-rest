// PayPal Orders API v2 — 서버 전용
// authorize → capture/void 패턴 (카드 선승인)

const PAYPAL_BASE =
    process.env.PAYPAL_MODE === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
    const clientId = process.env.PAYPAL_CLIENT_ID ?? process.env.VITE_PAYPAL_CLIENT_ID ?? "";
    const secret = process.env.PAYPAL_CLIENT_SECRET ?? "";
    const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");

    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!res.ok) throw new Error(`PayPal OAuth failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
}

import { fetchPythKrwRate } from "~/lib/pyth";

/** KRW 금액을 Pyth Hermes 환율로 USD 환산해 PayPal 주문 생성 (intent: AUTHORIZE) — 주문 ID 반환 */
export async function createPayPalOrder(amountKrw: number): Promise<string> {
    const token = await getAccessToken();
    const krwPerUsd = await fetchPythKrwRate();
    const amountUsd = (amountKrw / krwPerUsd).toFixed(2);

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            intent: "AUTHORIZE",
            purchase_units: [
                {
                    amount: {
                        currency_code: "USD",
                        value: amountUsd,
                    },
                },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`PayPal create order failed: ${err}`);
    }
    const order = (await res.json()) as { id: string };
    return order.id;
}

/** 사용자 승인 완료 후 주문을 authorize → authorization ID 반환 */
export async function authorizePayPalOrder(orderID: string): Promise<string> {
    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/authorize`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`PayPal authorize failed: ${err}`);
    }

    const data = (await res.json()) as {
        purchase_units: { payments: { authorizations: { id: string }[] } }[];
    };
    const authId = data.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
    if (!authId) throw new Error("PayPal authorization ID not found in response");
    return authId;
}

/** 호스트 승인 시 authorization capture (실결제) — capture ID 반환 */
export async function capturePayPalAuth(authorizationId: string): Promise<string> {
    const token = await getAccessToken();

    const res = await fetch(
        `${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}/capture`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`PayPal capture failed: ${err}`);
    }

    const data = (await res.json()) as { id: string };
    if (!data.id) throw new Error("PayPal capture ID not found in response");
    return data.id;
}

/** 카드 결제 환불 (capture 이후) — amountUsd 미지정 시 전액 환불 */
export async function refundPayPalCapture(captureId: string, amountUsd?: string): Promise<void> {
    const token = await getAccessToken();

    const body = amountUsd
        ? JSON.stringify({ amount: { currency_code: "USD", value: amountUsd } })
        : JSON.stringify({});

    const res = await fetch(
        `${PAYPAL_BASE}/v2/payments/captures/${captureId}/refund`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body,
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`PayPal refund failed: ${err}`);
    }
}

/** 호스트 거절 시 authorization void (전액 환불) */
export async function voidPayPalAuth(authorizationId: string): Promise<void> {
    const token = await getAccessToken();

    const res = await fetch(
        `${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}/void`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        }
    );

    // 204 No Content = 성공, 422 = 이미 void됨 (무시)
    if (!res.ok && res.status !== 422) {
        const err = await res.text();
        throw new Error(`PayPal void failed: ${err}`);
    }
}
