# Solana Payment State Machine & Logic
> Created: 2026-02-10 16:30
> Last Updated: 2026-02-10 16:30

## 1. Context

### 1.1. 기존 Booking State Machine과의 통합
기존 `01_BOOKING_STATE_MACHINE.md`의 결제 단계에 Solana 결제 분기를 추가한다. 기존 Stripe/PayPal 흐름은 변경하지 않으며, `paymentMethod` 필드로 분기한다.

### 1.2. SOL/USDC 결제의 기존 플로우 매핑
| 기존 Booking 상태 | Stripe 흐름 | Solana 흐름 |
|---|---|---|
| `pending` | PaymentIntent 생성 | 에스크로 트랜잭션 조립 |
| `awaiting_payment` | 카드 결제 대기 | 지갑 서명 대기 |
| `confirmed` | PaymentIntent 성공 | 트랜잭션 confirmed |
| `cancelled` | PaymentIntent 취소 | 에스크로 환불 |

---

## 2. Payment State Machine

### 2.1. 상태 정의

| 상태 | 설명 | 진입 조건 |
|------|------|-----------|
| `idle` | 초기 상태 | 결제 화면 진입 |
| `tx_created` | 트랜잭션 조립 완료 | 서버가 에스크로 인스트럭션 생성 |
| `tx_signed` | 사용자 서명 완료 | 지갑에서 승인 |
| `tx_submitted` | 네트워크 제출 완료 | 서명된 트랜잭션 전송 |
| `tx_confirming` | 확인 대기 중 | 네트워크에서 처리 중 |
| `tx_confirmed` | 트랜잭션 확정 | confirmationStatus === 'confirmed' |
| `settled` | 정산 완료 | 에스크로 릴리스 후 호스트 수령 |
| `tx_failed` | 트랜잭션 실패 | 네트워크 에러, 인스트럭션 실패 |
| `tx_expired` | 트랜잭션 만료 | 서명 대기 5분 초과 |
| `tx_rejected` | 사용자 거부 | 지갑에서 거부 |

### 2.2. 전이 다이어그램

```
                          ┌──────────┐
                          │   idle   │
                          └────┬─────┘
                               │ createPayment()
                               v
                          ┌──────────┐
                     ┌────│tx_created│────┐
                     │    └────┬─────┘    │
              timeout│         │ sign()   │ user reject
               (5min)│         v          │
                     v    ┌──────────┐    v
               ┌─────────│ tx_signed│  ┌──────────┐
               │tx_expired└────┬────┘  │tx_rejected│
               └─────────┘    │       └──────────┘
                               │ submit()
                               v
                          ┌───────────┐
                          │tx_submitted│
                          └─────┬─────┘
                                │ polling...
                                v
                          ┌────────────┐
                     ┌────│tx_confirming│────┐
                     │    └──────┬─────┘    │
                 fail│           │ confirmed │ timeout(60s)
                     v           v           v
               ┌─────────┐ ┌────────────┐ ┌─────────┐
               │tx_failed │ │tx_confirmed│ │tx_failed│
               └─────────┘ └──────┬─────┘ └─────────┘
                                   │ releaseEscrow()
                                   v
                              ┌────────┐
                              │settled │
                              └────────┘
```

### 2.3. 타이밍 파라미터

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| SIGN_TIMEOUT | 5분 | 사용자 서명 대기 최대 시간 |
| CONFIRM_TIMEOUT | 60초 | 트랜잭션 확인 대기 최대 시간 |
| CONFIRM_POLL_INTERVAL | 2초 | 확인 상태 폴링 간격 |
| RATE_VALIDITY | 5분 | 환율 고정 유효 시간 |
| ESCROW_HOLD_MAX | 72시간 | 체크인 미완료 시 에스크로 자동 릴리스까지 대기 |

---

## 3. Algorithm / Pseudo-code

### 3.1. createSolanaPayment
```typescript
async function createSolanaPayment(
    bookingId: string,
    payerWallet: PublicKey,
    amountKRW: number,
    tokenMint: 'SOL' | 'USDC'
): Promise<{ transaction: Transaction; escrowPDA: PublicKey; expiresAt: Date }> {
    // 1. 환율 조회
    const rate = await fetchExchangeRate(tokenMint);
    const amount = convertKRWToToken(amountKRW, rate, tokenMint);

    // 2. 에스크로 PDA 도출
    const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(bookingId), Buffer.from("escrow")],
        PAYMENT_PROGRAM_ID
    );

    // 3. 인스트럭션 조립
    const ix = tokenMint === 'SOL'
        ? createSOLEscrowInstruction(payerWallet, escrowPDA, amount)
        : createUSDCEscrowInstruction(payerWallet, escrowPDA, amount);

    // 4. 트랜잭션 생성 (미서명)
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = payerWallet;

    // 5. DB 기록
    await db.insert(walletTransactions).values({
        id: uuidv4(),
        bookingId,
        txSignature: '', // 서명 후 업데이트
        type: 'payment',
        fromWallet: payerWallet.toBase58(),
        toWallet: escrowPDA.toBase58(),
        amount,
        tokenMint: tokenMint === 'SOL' ? null : USDC_MINT,
        status: 'pending',
    });

    return {
        transaction: tx,
        escrowPDA,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 후 만료
    };
}
```

### 3.2. confirmSolanaTransaction
```typescript
async function confirmSolanaTransaction(
    bookingId: string,
    txSignature: string
): Promise<{ status: 'confirmed' | 'failed' }> {
    // 1. 온체인 트랜잭션 확인
    const result = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
    });

    if (!result || result.meta?.err) {
        await updateTransactionStatus(txSignature, 'failed');
        return { status: 'failed' };
    }

    // 2. 금액/수신자 검증 (위변조 방지)
    const verified = verifyTransactionDetails(result, bookingId);
    if (!verified) {
        await updateTransactionStatus(txSignature, 'failed');
        return { status: 'failed' };
    }

    // 3. DB 업데이트
    await updateTransactionStatus(txSignature, 'confirmed');
    await updateBookingStatus(bookingId, 'confirmed');

    return { status: 'confirmed' };
}
```

### 3.3. processRefund
```typescript
async function processRefund(
    bookingId: string,
    refundPercent: number // 0-100
): Promise<{ txSignature: string }> {
    // 1. 에스크로 상태 확인
    const escrow = await getEscrowInfo(bookingId);
    if (!escrow) throw new Error('Escrow not found');

    // 2. 환불 금액 계산
    const refundAmount = escrow.amount * (refundPercent / 100);
    const hostAmount = escrow.amount - refundAmount;

    // 3. 환불 + 호스트 정산 트랜잭션 조립
    const tx = new Transaction();
    if (refundAmount > 0) {
        tx.add(createRefundInstruction(escrow.pda, escrow.payer, refundAmount));
    }
    if (hostAmount > 0) {
        tx.add(createReleaseInstruction(escrow.pda, escrow.host, hostAmount));
    }

    // 4. 서버 키로 서명 및 전송
    const txSignature = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);

    // 5. DB 기록
    await db.insert(walletTransactions).values({
        id: uuidv4(),
        bookingId,
        txSignature,
        type: 'refund',
        fromWallet: escrow.pda.toBase58(),
        toWallet: escrow.payer.toBase58(),
        amount: refundAmount,
        tokenMint: escrow.tokenMint,
        status: 'confirmed',
    });

    return { txSignature };
}
```

### 3.4. checkTransactionStatus (폴링)
```typescript
async function pollTransactionStatus(
    txSignature: string,
    maxAttempts: number = 30,   // 60초 (2초 간격)
    intervalMs: number = 2000
): Promise<'confirmed' | 'failed' | 'timeout'> {
    for (let i = 0; i < maxAttempts; i++) {
        const status = await connection.getSignatureStatus(txSignature);

        if (status?.value?.confirmationStatus === 'confirmed' ||
            status?.value?.confirmationStatus === 'finalized') {
            return 'confirmed';
        }

        if (status?.value?.err) {
            return 'failed';
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return 'timeout';
}
```

---

## 4. 에스크로 로직

### 4.1. 에스크로 PDA 생성
- Seeds: `[booking_id_bytes, "escrow"]`
- 각 예약마다 고유한 에스크로 계정 생성
- PDA는 프로그램이 소유하므로 외부에서 인출 불가

### 4.2. 에스크로 릴리스 조건
| 조건 | 릴리스 대상 | 트리거 |
|------|-----------|--------|
| 체크인 완료 | 호스트 (수수료 차감 후) | 서버 cron 또는 호스트 확인 |
| 체크아웃 완료 + 24시간 경과 | 호스트 | 자동 (타이머) |
| 72시간 경과 (체크인 없음) | 호스트 | 자동 (분쟁 없으면) |

### 4.3. 에스크로 환불 조건
- 취소 정책에 따른 환불률 적용 (7일 전 100%, 3일 전 50%, 이후 0%)
- 호스트 미승인 시 48시간 후 자동 환불
- 분쟁 발생 시: 플랫폼 관리자 개입 (멀티시그 결정)

---

## 5. 기존 Booking State Machine 확장

### 5.1. bookings 테이블 필드 추가
```typescript
// 기존 bookings 테이블에 추가
paymentMethod: text("payment_method", {
    enum: ["stripe", "paypal", "sol", "usdc"]
}).default("stripe"),
txSignature: text("tx_signature"),
escrowPDA: text("escrow_pda"),
```

### 5.2. 결제 수단별 분기 처리
```typescript
async function processPayment(booking: Booking) {
    switch (booking.paymentMethod) {
        case 'stripe':
            return processStripePayment(booking);
        case 'paypal':
            return processPayPalPayment(booking);
        case 'sol':
        case 'usdc':
            return processSolanaPayment(booking);
    }
}
```

### 5.3. 결제 확인 통합
- Stripe: webhook으로 비동기 확인
- Solana: 폴링 + RPC 확인 (또는 Helius 웹훅)
- 공통: `booking.status` -> `confirmed` 업데이트

---

## 6. Edge Cases

### 6.1. 트랜잭션 제출 후 네트워크 단절
- 클라이언트가 `txSignature`를 로컬에 저장
- 재접속 시 서버에 `txSignature`로 상태 조회
- 서버가 온체인 확인 후 booking 상태 동기화

### 6.2. 동일 예약 이중 결제 방지
- 에스크로 PDA가 booking별 유일 -> 이미 생성되면 재생성 실패
- 클라이언트에서 결제 버튼 disable 처리
- 서버에서 booking.status !== 'pending' 이면 결제 거부

### 6.3. 환율 변동으로 인한 금액 불일치
- 트랜잭션 생성 시 고정된 환율과 실제 전송 금액을 서버에서 비교
- 슬리피지 허용 범위(SOL 1%, USDC 0.1%) 초과 시 트랜잭션 거부
- 사용자에게 환율 갱신 후 재시도 안내

### 6.4. 지갑 잔액 부족 사전 검증
```typescript
async function validateBalance(wallet: PublicKey, amount: number, tokenMint: string | null) {
    if (!tokenMint) {
        // SOL 잔액 확인 (가스비 포함)
        const balance = await connection.getBalance(wallet);
        const required = amount + 5000; // lamports for gas
        return balance >= required;
    } else {
        // SPL Token 잔액 확인
        const ata = getAssociatedTokenAddressSync(new PublicKey(tokenMint), wallet);
        const tokenBalance = await connection.getTokenAccountBalance(ata);
        return Number(tokenBalance.value.amount) >= amount;
    }
}
```

---

## 7. Related Documents
- **Foundation**: [Blockchain Roadmap](../01_Concept_&_Design/09_BLOCKCHAIN_ROADMAP.md) - Phase 1 결제 마일스톤
- **Specs**: [Solana Payment Spec](../03_Technical_Specs/09_SOLANA_PAYMENT_SPEC.md) - API 엔드포인트, 환율 처리
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - Payment Program 아키텍처
- **Logic**: [Booking State Machine](./01_BOOKING_STATE_MACHINE.md) - 기존 예약 상태 머신
- **Test**: [Blockchain Test Scenarios](../05_QA_&_Validation/06_BLOCKCHAIN_TEST_SCENARIOS.md) - TC-BC-010~016
