import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — LaneBrief",
  description:
    "LaneBrief privacy policy. Learn how we collect, use, and protect your information.",
  alternates: {
    canonical: "https://lanebrief.com/privacy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-8 inline-block"
          >
            ← Back to LaneBrief
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Privacy Policy</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            <strong className="text-zinc-300">Effective Date:</strong> April 5, 2026 &nbsp;·&nbsp;{" "}
            <strong className="text-zinc-300">Last Updated:</strong> April 5, 2026
          </p>
          <p className="text-zinc-300 mt-4">
            LaneBrief (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the
            website at lanebrief.com and provides freight intelligence services to independent
            freight brokers. This Privacy Policy explains how we collect, use, disclose, and protect
            your information.
          </p>
          <p className="text-zinc-300 mt-3">
            By using our services, you agree to the collection and use of information as described
            in this policy.
          </p>
        </div>

        <div className="space-y-10 text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <h3 className="text-base font-medium text-zinc-200 mb-2">
              Information You Provide
            </h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-2">
              <li>
                <strong className="text-zinc-200">Account information:</strong> Name and email
                address when you create an account.
              </li>
              <li>
                <strong className="text-zinc-200">Freight business data:</strong> Origin and
                destination lanes, equipment types (dry van, flatbed, refrigerated, step deck), rate
                information ($/mile), carrier names, and MC numbers.
              </li>
              <li>
                <strong className="text-zinc-200">Payment information:</strong> Billing details
                processed through our payment provider, Stripe. We do not store your full credit
                card number on our servers.
              </li>
              <li>
                <strong className="text-zinc-200">Communications:</strong> Emails or messages you
                send to us at{" "}
                <a
                  href="mailto:intel@lanebrief.com"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  intel@lanebrief.com
                </a>{" "}
                or{" "}
                <a
                  href="mailto:nick@lanebrief.com"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  nick@lanebrief.com
                </a>
                .
              </li>
            </ul>

            <h3 className="text-base font-medium text-zinc-200 mt-5 mb-2">
              Information Collected Automatically
            </h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-2">
              <li>
                <strong className="text-zinc-200">Usage data:</strong> Pages visited, features
                used, time spent on the site, and referring URLs.
              </li>
              <li>
                <strong className="text-zinc-200">Device data:</strong> Browser type, operating
                system, IP address, and device identifiers.
              </li>
              <li>
                <strong className="text-zinc-200">Cookies and tracking technologies:</strong> We
                use cookies and similar technologies to operate our site and analyze usage. See
                Section 5 below.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              2. How We Use Your Information
            </h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Provide, maintain, and improve our freight intelligence services.</li>
              <li>
                Generate AI-powered lane analysis briefs, rate forecasts, and capacity indicators
                tailored to your selected lanes.
              </li>
              <li>Process payments and manage your subscription.</li>
              <li>
                Send service-related communications, including weekly alerts and monthly briefs.
              </li>
              <li>Analyze site usage to improve performance and user experience.</li>
              <li>Respond to your inquiries and provide customer support.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              3. How We Share Your Information
            </h2>
            <p className="mb-3">
              We do not sell your personal information. We share information only in the following
              circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-zinc-200">Service providers:</strong> We use third-party
                services to operate our business, including:
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-zinc-400">
                  <li>Stripe for payment processing.</li>
                  <li>Clerk for authentication and account management.</li>
                  <li>Google Analytics for website analytics.</li>
                  <li>Meta (Facebook) Pixel for advertising measurement.</li>
                  <li>Vercel for website hosting and infrastructure.</li>
                  <li>Resend for transactional email delivery.</li>
                </ul>
              </li>
              <li className="mt-2">
                <strong className="text-zinc-200">Data sources:</strong> We incorporate publicly
                available freight data from sources such as DAT, load board feeds, and FMCSA carrier
                records to generate your intelligence briefs. Your lane selections inform which data
                we retrieve, but we do not share your account information with these data sources.
              </li>
              <li>
                <strong className="text-zinc-200">Legal requirements:</strong> We may disclose
                information if required by law, regulation, legal process, or governmental request.
              </li>
              <li>
                <strong className="text-zinc-200">Business transfers:</strong> In connection with a
                merger, acquisition, or sale of assets, your information may be transferred as part
                of that transaction.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. AI Processing</h2>
            <p>
              LaneBrief uses artificial intelligence to synthesize freight market data and generate
              lane intelligence briefs, rate forecasts, and carrier reliability assessments. Your
              lane selections, equipment types, and rate data are processed by our AI systems to
              produce personalized reports. We use AI to synthesize and forecast — not to fabricate
              data.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              5. Cookies and Tracking Technologies
            </h2>
            <p className="mb-3">
              We use the following cookies and tracking technologies:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-zinc-200">Essential cookies:</strong> Required for
                authentication and site functionality (provided by Clerk).
              </li>
              <li>
                <strong className="text-zinc-200">Analytics cookies:</strong> Google Analytics (ID:
                G-PN0HDJH7B1) to understand how visitors use our site. You can opt out via{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Google&apos;s opt-out browser add-on
                </a>
                .
              </li>
              <li>
                <strong className="text-zinc-200">Advertising cookies:</strong> Meta (Facebook)
                Pixel to measure the effectiveness of our advertising. You can manage your ad
                preferences through{" "}
                <a
                  href="https://www.facebook.com/adpreferences"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Meta&apos;s ad settings
                </a>
                .
              </li>
            </ul>
            <p className="mt-3">
              You can control cookies through your browser settings. Disabling certain cookies may
              affect site functionality.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p>
              We retain your account and freight business data for as long as your account is active
              or as needed to provide our services. If you cancel your subscription, we retain your
              data for up to 90 days to allow for reactivation, after which it is deleted. We may
              retain certain information longer as required by law or for legitimate business
              purposes (e.g., resolving disputes).
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Data Security</h2>
            <p>
              We implement commercially reasonable technical and organizational measures to protect
              your information, including encryption in transit (TLS) and secure hosting
              infrastructure. No method of transmission or storage is 100% secure, and we cannot
              guarantee absolute security.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Your Rights</h2>
            <p className="mb-3">
              Depending on your jurisdiction, you may have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-zinc-200">Access</strong> the personal information we hold
                about you.
              </li>
              <li>
                <strong className="text-zinc-200">Correct</strong> inaccurate or incomplete
                information.
              </li>
              <li>
                <strong className="text-zinc-200">Delete</strong> your personal information.
              </li>
              <li>
                <strong className="text-zinc-200">Object to</strong> or{" "}
                <strong className="text-zinc-200">restrict</strong> certain processing of your
                data.
              </li>
              <li>
                <strong className="text-zinc-200">Data portability</strong> — receive your data in
                a structured, machine-readable format.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:intel@lanebrief.com"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                intel@lanebrief.com
              </a>
              . We will respond within 30 days.
            </p>

            <h3 className="text-base font-medium text-zinc-200 mt-5 mb-2">
              California Residents (CCPA)
            </h3>
            <p>
              If you are a California resident, you have additional rights under the California
              Consumer Privacy Act, including the right to know what personal information we collect
              and the right to opt out of the sale of personal information. We do not sell personal
              information.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Children&apos;s Privacy</h2>
            <p>
              Our services are intended for business use by freight industry professionals. We do
              not knowingly collect information from individuals under the age of 18. If we learn
              that we have collected information from a child under 18, we will delete it promptly.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. International Users</h2>
            <p>
              Our services are hosted in the United States. If you access our services from outside
              the United States, your information will be transferred to and processed in the United
              States. By using our services, you consent to this transfer.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on our website and updating the &ldquo;Last
              Updated&rdquo; date above. Your continued use of our services after changes are posted
              constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">12. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:</p>
            <div className="mt-3 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="font-semibold text-white">LaneBrief</p>
              <p className="mt-1">
                Email:{" "}
                <a
                  href="mailto:intel@lanebrief.com"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  intel@lanebrief.com
                </a>
              </p>
              <p>
                Website:{" "}
                <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                  https://lanebrief.com
                </Link>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-zinc-800 text-center text-zinc-500 text-sm">
          <p>
            &copy; {new Date().getFullYear()} LaneBrief. All rights reserved.
          </p>
          <p className="mt-2">
            <Link href="/" className="hover:text-zinc-300 transition-colors">
              Home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
