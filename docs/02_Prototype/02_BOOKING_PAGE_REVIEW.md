# 02. Booking & Payment Page Review (V2)
> Created: 2026-02-07 17:01
> Last Updated: 2026-02-07 17:01

## 1. Prototype Link/Screenshot
*   **Project Name**: Rural Rest V2
*   **Screen Name**: Confirm and Pay Rural Rest
*   **Style**: Shadcn/UI Aesthetic (Clean Forms)

## 2. Key User Flows (Demonstrated)
1.  **Transparency First**:
    *   **Trip Details**: Clean card showing Dates (Oct 12-14) and Guests (1 Guest) with accessible "Edit" buttons.
2.  **Upsell Integration (Shadcn Style)**:
    *   **Add-on Card**: "Bul-meong Kit (+$20)" and "BBQ Set (+$30)" use standard Shadcn checkboxes.
    *   **Placement**: Positioned *before* the total calculation to encourage selection.
3.  **Clear Pricing**:
    *   **Line Items**: Room Rate, Service Fee, Add-ons clearly listed.
    *   **Total Highlighting**: Bold text for the final amount.
4.  **Trust Signals**:
    *   **Payment**: PayPal + Credit Card Radio Group.
    *   **Security**: "Your payment is secure" with a lock icon near the CTA.

## 3. Feedback & Improvements
### 3.1. Strengths (Keep)
*   **Readability**: The Inter font and clean borders (`border-slate-200`) make the numbers easy to read.
*   **Form Structure**: Separation of Trip Details, Add-ons, and Payment into distinct sections reduces cognitive load.
*   **CTA**: The Warm Brown "Confirm and Pay" button is prominent and inviting.

### 3.2. Issues & To-Do (Fix before Logic)
*   [ ] **Currency**: Ensure the currency symbol ($ vs ₩) matches the user's locale.
*   [ ] **Cancel Policy**: A link to the cancellation policy is still missing near the payment button.
*   [ ] **Guest Validation**: Need to ensure the "Edit" guest flow handles room capacity limits.

## 4. Next Step
*   Design the **Admin Dashboard (Host View)** to complete the V2 prototype set.
