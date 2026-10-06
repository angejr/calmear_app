<script setup lang="ts">
useSeoMeta({
  title: 'Privacy Policy — CalmEar',
  description: 'How CalmEar handles your data. Audio processing happens locally in your browser — we never upload the audio you listen to.',
})

const lastUpdated = '5 October 2026'
const contactEmail = 'ericmrleliko@gmail.com'
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <div class="mb-12">
        <h1 class="text-4xl font-bold text-neutral-900 mb-3">Privacy Policy</h1>
        <p class="text-sm text-neutral-500">Last updated: {{ lastUpdated }}</p>
      </div>

      <!-- Summary box -->
      <div class="card bg-primary-50 border-primary-100 p-6 mb-12">
        <h2 class="font-semibold text-neutral-900 mb-2">The short version</h2>
        <ul class="space-y-2 text-sm text-neutral-700">
          <li class="flex gap-2"><span class="text-primary-600">•</span><span><strong>Your audio never leaves your device.</strong> All sound processing happens locally in your browser.</span></li>
          <li class="flex gap-2"><span class="text-primary-600">•</span><span>We store your <strong>email address</strong> and subscription status. That's essentially it.</span></li>
          <li class="flex gap-2"><span class="text-primary-600">•</span><span><strong>Payment details are handled by Stripe</strong> and never touch our servers.</span></li>
          <li class="flex gap-2"><span class="text-primary-600">•</span><span><strong>Our website uses advertising measurement</strong> (Google Tag Manager and the Reddit Pixel) to see whether our ads lead to sign-ups. The extension has no trackers, and we never sell your data.</span></li>
          <li class="flex gap-2"><span class="text-primary-600">•</span><span>The extension stores only a login token and your on/off preference, on your own device.</span></li>
        </ul>
      </div>

      <div class="space-y-12">
        <section id="introduction">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">1. Introduction</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            This Privacy Policy explains what information the CalmEar Chrome extension and the
            CalmEar website (together, "CalmEar", "we", "us") collect, how we use it, and the
            choices you have. CalmEar detects and reduces triggering mouth sounds in your browser
            so you can watch videos comfortably.
          </p>
          <p class="text-neutral-700 leading-relaxed">
            This policy applies to the CalmEar browser extension and the website at calmear-app.com,
            including its dashboard and account features.
          </p>
        </section>

        <section id="audio">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">2. Your audio — processed locally, never uploaded</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            The core promise of CalmEar: <strong>the audio you listen to is processed entirely on
            your own device.</strong> CalmEar uses a machine-learning model that runs locally inside
            your browser to detect and reduce mouth sounds in real time.
          </p>
          <ul class="space-y-2 mb-4">
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>We do <strong>not</strong> record, store, or capture your audio.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>We do <strong>not</strong> upload, stream, or transmit any audio to our servers or any third party.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Audio analysis happens in memory, on your device, and is discarded immediately.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Because audio never leaves your device, it is not "personal data" that we process.</span></li>
          </ul>
          <p class="text-neutral-700 leading-relaxed">
            The extension requests permission to run on YouTube pages so that it can access the
            audio being played and filter it. It does not read page content, does not track which
            videos you watch, and does not report your browsing activity anywhere.
          </p>
        </section>

        <section id="extension-data">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">3. Data the browser extension stores</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            The extension stores the following in your browser's local storage
            (<code class="text-xs bg-neutral-100 rounded px-1.5 py-0.5">chrome.storage.local</code>)
            on your device:
          </p>
          <div class="overflow-x-auto mb-4">
            <table class="w-full text-sm border border-neutral-200 rounded-xl overflow-hidden">
              <thead class="bg-neutral-50">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold text-neutral-800">Item</th>
                  <th class="text-left px-4 py-3 font-semibold text-neutral-800">Purpose</th>
                  <th class="text-left px-4 py-3 font-semibold text-neutral-800">Leaves your device?</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr><td class="px-4 py-3 text-neutral-700">Login token</td><td class="px-4 py-3 text-neutral-700">Keeps you signed in to your CalmEar account</td><td class="px-4 py-3 text-neutral-700">Sent only to calmear-app.com when checking your subscription</td></tr>
                <tr><td class="px-4 py-3 text-neutral-700">Subscription status cache</td><td class="px-4 py-3 text-neutral-700">Remembers your plan so the extension works without constant network requests</td><td class="px-4 py-3 text-neutral-700">No (local cached copy)</td></tr>
                <tr><td class="px-4 py-3 text-neutral-700">On/off preference</td><td class="px-4 py-3 text-neutral-700">Remembers whether you have filtering enabled</td><td class="px-4 py-3 text-neutral-700">No</td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-neutral-700 leading-relaxed">
            The extension communicates with calmear-app.com only to (1) sign you in, and (2) check
            whether your account has active access (your subscription or trial status). These
            requests contain only your login token — no audio, no browsing data, no video information.
          </p>
        </section>

        <section id="account-data">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">4. Data we collect on the website</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            When you create a CalmEar account (required for the free trial and subscription), we collect:
          </p>
          <ul class="space-y-2 mb-4">
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Email address</strong> — provided by you during sign-up (directly, or via your Google account if you sign in with Google).</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Account identifiers</strong> — an internal user ID and an authentication ID issued by our sign-in provider (Clerk).</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Subscription state</strong> — trial dates, subscription status, and Stripe customer/subscription reference IDs.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Extension session records</strong> — a cryptographic hash of your extension login token (never the token itself), plus creation and expiry timestamps, so the extension can be signed in securely and sessions can be revoked.</span></li>
          </ul>
          <p class="text-neutral-700 leading-relaxed mb-4">
            When you visit calmear-app.com, our advertising measurement tags (loaded through Google
            Tag Manager) send information about your visit to Reddit: for example the pages you view
            on our website, technical details such as your browser, device and IP address, a cookie
            identifier, whether you created an account, and whether you subscribed (the plan and its
            price). Reddit uses this to tell us whether visitors coming from our Reddit ads sign up
            or subscribe. We do not send your email address or your
            CalmEar account details to Reddit.
          </p>
          <p class="text-neutral-700 leading-relaxed">
            We do not collect your name (beyond what your email or Google account provides), address,
            phone number, browsing history outside our website, watch history, or any content from the
            pages you visit.
          </p>
        </section>

        <section id="payments">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">5. Payment data</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            Payments for CalmEar Premium are processed by <strong>Stripe, Inc.</strong> When you
            subscribe, you enter your payment details (card number, expiry, security code) directly
            into Stripe's secure checkout. <strong>These details never reach CalmEar's servers</strong>
            and we never see, store, or have access to your full card number.
          </p>
          <p class="text-neutral-700 leading-relaxed">
            We receive from Stripe only what is needed to operate your subscription: a customer
            reference ID, subscription status, renewal date, and confirmation of payment. You can
            review Stripe's own privacy practices at
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener" class="text-primary-600 hover:underline">stripe.com/privacy</a>.
          </p>
        </section>

        <section id="third-parties">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">6. Third-party services</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">CalmEar relies on the following service providers:</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm border border-neutral-200 rounded-xl overflow-hidden">
              <thead class="bg-neutral-50">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold text-neutral-800">Provider</th>
                  <th class="text-left px-4 py-3 font-semibold text-neutral-800">Role</th>
                  <th class="text-left px-4 py-3 font-semibold text-neutral-800">What they receive</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr><td class="px-4 py-3 text-neutral-700 font-medium">Clerk</td><td class="px-4 py-3 text-neutral-700">Sign-in and authentication</td><td class="px-4 py-3 text-neutral-700">Your email address (and Google account identifiers if you sign in with Google)</td></tr>
                <tr><td class="px-4 py-3 text-neutral-700 font-medium">Stripe</td><td class="px-4 py-3 text-neutral-700">Payment processing</td><td class="px-4 py-3 text-neutral-700">Your payment details and billing information (entered directly with Stripe)</td></tr>
                <tr><td class="px-4 py-3 text-neutral-700 font-medium">Supabase</td><td class="px-4 py-3 text-neutral-700">Database hosting (EU region)</td><td class="px-4 py-3 text-neutral-700">The account records described in Section 4</td></tr>
                <tr><td class="px-4 py-3 text-neutral-700 font-medium">Google (Tag Manager)</td><td class="px-4 py-3 text-neutral-700">Loads our advertising measurement tags on the website</td><td class="px-4 py-3 text-neutral-700">Technical data needed to load the tags, such as your IP address and browser details</td></tr>
                <tr><td class="px-4 py-3 text-neutral-700 font-medium">Reddit</td><td class="px-4 py-3 text-neutral-700">Advertising measurement (Reddit Pixel) on the website</td><td class="px-4 py-3 text-neutral-700">Information about your visit to calmear-app.com and whether you signed up or subscribed, as described in Section 4</td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-neutral-700 leading-relaxed mt-4">
            Each provider processes data under its own privacy policy and applicable data-processing
            agreements. Clerk, Stripe and Supabase are used solely to operate CalmEar. Google and
            Reddit process website visit data under their own terms; see
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" class="text-primary-600 hover:underline">Google's privacy policy</a>
            and
            <a href="https://www.reddit.com/policies/privacy-policy" target="_blank" rel="noopener" class="text-primary-600 hover:underline">Reddit's privacy policy</a>.
            None of them receive any audio, and the extension sends nothing to Google or Reddit.
          </p>
        </section>

        <section id="how-we-use">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">7. How we use your data</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">We use the limited data we hold only to:</p>
          <ul class="space-y-2">
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Provide the CalmEar service — verify that your account has access to the extension's filtering features.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Manage your free trial and subscription.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Let you sign in securely and connect the extension to your account.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Measure whether our advertising leads to sign-ups and subscriptions (website only, see Section 4).</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Respond to support requests you send us.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span>Meet legal obligations (for example, accounting records for payments).</span></li>
          </ul>
        </section>

        <section id="what-we-dont-do">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">8. What we do not do</h2>
          <ul class="space-y-2">
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">✕</span><span><strong>Sell or rent your personal data</strong>, or share your email address or account details with advertisers.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">✕</span><span><strong>Put trackers in the extension.</strong> Advertising measurement runs only on our website (see Section 4).</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">✕</span><span><strong>Track what you watch.</strong> The extension never reports the pages you visit or videos you play.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">✕</span><span><strong>Collect or upload audio.</strong> All audio processing is local to your device.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">✕</span><span><strong>Build a profile of you.</strong> We only keep what is needed to run your account.</span></li>
          </ul>
        </section>

        <section id="retention">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">9. Data retention and deletion</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            We keep your account data for as long as your account exists. Extension login tokens are
            stored only as one-way hashes and expire automatically after one year; you can revoke
            them at any time by signing out from the extension or your dashboard.
          </p>
          <p class="text-neutral-700 leading-relaxed mb-4">
            You can delete your account at any time from your account settings. Your CalmEar account
            data is then deleted straight away, the extension is signed out, and any active
            subscription is cancelled so you are not charged again (the current billing period is not
            refunded). We keep only a one-way hash of your email address, which cannot be turned back
            into the address, so that the free trial cannot be used twice. Limited records we are
            required to keep for legal or accounting purposes (for example, Stripe payment records)
            are also kept.
          </p>
          <p class="text-neutral-700 leading-relaxed">
            You can also request deletion by emailing us at
            <a :href="`mailto:${contactEmail}`" class="text-primary-600 hover:underline">{{ contactEmail }}</a>;
            we will delete your records within 30 days.
          </p>
        </section>

        <section id="security">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">10. Security</h2>
          <p class="text-neutral-700 leading-relaxed">
            We protect your data with industry-standard measures: authentication is handled by Clerk,
            payment data never touches our servers (Stripe), extension login tokens are stored only
            as SHA-256 hashes (so even our database never contains your actual token), and all
            communication between the extension, the website, and our API uses HTTPS. No system is
            perfectly secure, but we have designed CalmEar so that the most sensitive thing you have —
            the audio you listen to — simply never leaves your device.
          </p>
        </section>

        <section id="gdpr">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">11. Your rights (GDPR)</h2>
          <p class="text-neutral-700 leading-relaxed mb-4">
            If you are in the European Economic Area, you have the right to:
          </p>
          <ul class="space-y-2 mb-4">
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Access</strong> the personal data we hold about you.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Correct</strong> inaccurate data (you can update your email in your account profile).</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Delete</strong> your account and data (see Section 9).</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Object to or restrict</strong> processing of your data.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Portability</strong> — receive a copy of your data in a machine-readable format.</span></li>
            <li class="flex gap-2 text-neutral-700"><span class="text-primary-600 shrink-0">•</span><span><strong>Lodge a complaint</strong> with your local data protection authority.</span></li>
          </ul>
          <p class="text-neutral-700 leading-relaxed">
            The legal basis for processing your account data is the performance of our contract with
            you (providing the CalmEar service).
            You can block these tags with your browser's privacy settings or a content blocker.
            To exercise any of these rights, email
            <a :href="`mailto:${contactEmail}`" class="text-primary-600 hover:underline">{{ contactEmail }}</a>.
          </p>
        </section>

        <section id="children">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">12. Children's privacy</h2>
          <p class="text-neutral-700 leading-relaxed">
            CalmEar is not directed at children under 16, and we do not knowingly collect personal
            data from children under 16. If you believe a child has provided us personal data,
            please contact us and we will delete it.
          </p>
        </section>

        <section id="changes">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">13. Changes to this policy</h2>
          <p class="text-neutral-700 leading-relaxed">
            If we make material changes to this policy, we will update the "Last updated" date above
            and, where appropriate, notify you by email or a notice on the website. Continued use of
            CalmEar after changes take effect constitutes acceptance of the updated policy.
          </p>
        </section>

        <section id="contact">
          <h2 class="text-2xl font-bold text-neutral-900 mb-4">14. Contact</h2>
          <p class="text-neutral-700 leading-relaxed">
            Questions about this policy or your data? Email us at
            <a :href="`mailto:${contactEmail}`" class="text-primary-600 hover:underline">{{ contactEmail }}</a>.
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
