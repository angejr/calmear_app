# CalmEar Chrome Extension Integration Guide

This document is the complete specification for connecting the CalmEar extension to the web platform. You do not need to read the website source code to integrate.

## Overview

1. **Pair** — user generates a one-time code on `calmear.com/dashboard` and enters it in the extension
2. **Store token** — extension receives a long-lived bearer token and stores it locally
3. **Check entitlement** — extension calls `/api/extension/entitlement` before enabling audio processing

---

## 1. Pair the Extension

User visits `calmear.com/dashboard` → clicks **Connect Chrome Extension** → dashboard shows a code like `CALM-A72K-91QP`.

### `POST /api/extension/activate`

No authentication required (the code proves authorization).

```http
POST https://calmear.com/api/extension/activate
Content-Type: application/json

{ "code": "CALM-A72K-91QP" }
```

**Success (200):**
```json
{ "token": "a3f8c2e1d9b047f6...", "expiresAt": "2027-09-04T18:00:00.000Z" }
```

**Errors:** `400` invalid/expired/used code · `429` rate limited (wait 60s)

Code is **single-use** and expires in **10 minutes**.

---

## 2. Store the Token

```ts
await chrome.storage.local.set({ calmearToken: token, calmearTokenExpiresAt: expiresAt })
```

Token is valid for **365 days**. Never expose it to web page JavaScript.

---

## 3. Check Entitlement

### `GET /api/extension/entitlement`

```http
GET https://calmear.com/api/extension/entitlement
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "active": true,
  "plan": "trial",
  "trialEndsAt": "2026-10-04T12:00:00.000Z",
  "subscriptionEndsAt": null
}
```

| Field | Type | Description |
|---|---|---|
| `active` | `boolean` | Whether the user currently has active access |
| `plan` | `"trial" \| "premium" \| "free"` | Current plan tier |
| `trialEndsAt` | `string \| null` | ISO timestamp of trial end |
| `subscriptionEndsAt` | `string \| null` | ISO timestamp of subscription period end |

| Plan | `active` | Meaning |
|---|---|---|
| `trial` | `true` | Within the 30-day free trial |
| `premium` | `true` | Active paid subscription |
| `free` | `false` | Trial expired, no active subscription |

**Integration pattern:**
```ts
async function checkAndEnableCalmEar() {
  const { calmearToken } = await chrome.storage.local.get('calmearToken')
  if (!calmearToken) { showPairingPrompt(); return }

  try {
    const res = await fetch('https://calmear.com/api/extension/entitlement', {
      headers: { Authorization: `Bearer ${calmearToken}` },
    })
    if (res.status === 401) {
      await chrome.storage.local.remove(['calmearToken', 'calmearTokenExpiresAt'])
      showPairingPrompt(); return
    }
    const { active } = await res.json()
    if (active) { runExistingCalmEarAudioPipeline() }
    else { showUpgradePrompt() }
  } catch {
    // Network error — fail open
    runExistingCalmEarAudioPipeline()
  }
}
```

---

## 4. Plan States

```ts
switch (entitlement.plan) {
  case 'trial':   // active trial — full access
  case 'premium': // paid subscription — full access
    runExistingCalmEarAudioPipeline(); break
  case 'free':    // trial expired — no access
    disableCalmEarAudioPipeline()
    showSubscribePrompt() // direct to calmear.com/pricing
    break
}
```

---

## 5. Logout / Revoke Token

### `DELETE /api/extension/session`

```http
DELETE https://calmear.com/api/extension/session
Authorization: Bearer <token>
```

```ts
await fetch('https://calmear.com/api/extension/session', {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${storedToken}` },
})
await chrome.storage.local.remove(['calmearToken', 'calmearTokenExpiresAt'])
```

---

## 6. Error Reference

| Status | Meaning | Action |
|---|---|---|
| `200` | Success | Process response |
| `400` | Invalid/expired/used pairing code | Instruct user to generate new code |
| `401` | Invalid/expired/revoked token | Clear token, prompt re-pair |
| `429` | Rate limited | Retry after 60 seconds |
| `5xx` | Server error | Fail open, log error |

---

## 7. Polling Frequency

Check entitlement **once per browser startup** and **once per YouTube tab activation**. Do not poll more frequently than every 5 minutes. Subscription changes (trial → premium, premium → free) are reflected on the next check without reinstalling or re-pairing.

---

## Quick Reference

```
Base URL: https://calmear.com  (dev: http://localhost:3000)

Pair:    POST /api/extension/activate       body: { code }  → { token, expiresAt }
Access:  GET  /api/extension/entitlement    header: Authorization: Bearer <token>  → { active, plan, ... }
Revoke:  DELETE /api/extension/session      header: Authorization: Bearer <token>
```
