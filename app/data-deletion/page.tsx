import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion Request — LaneBrief",
  description:
    "Request deletion of your personal data from LaneBrief, including data collected through Meta (Facebook/Instagram) integrations.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://lanebrief.com/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 py-4 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-primary font-semibold text-lg hover:opacity-80 transition-opacity">
            LaneBrief
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Data Deletion Request</h1>
          <p className="text-muted-foreground mb-10 text-sm">Last updated: April 2026</p>

          <p className="text-muted-foreground mb-8">
            <strong className="text-foreground">LaneBrief</strong> respects your right to control your personal data.
            If you would like to request deletion of your data from our systems, you can do so using the methods below.
          </p>

          <hr className="border-border/40 mb-8" />

          {/* Option 1 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">How to Request Data Deletion</h2>

            <h3 className="text-base font-semibold mb-2">Option 1: Email Request</h3>
            <p className="text-muted-foreground mb-2">
              Send an email to{" "}
              <a href="mailto:intel@lanebrief.com" className="text-primary hover:underline">
                intel@lanebrief.com
              </a>{" "}
              with the subject line <strong className="text-foreground">&ldquo;Data Deletion Request&rdquo;</strong> and include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1 ml-2">
              <li>Your full name</li>
              <li>The email address associated with your LaneBrief account</li>
            </ul>
            <p className="text-muted-foreground">We will process your request and confirm deletion within <strong className="text-foreground">30 days</strong>.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-base font-semibold mb-2">Option 2: Account Self-Service</h3>
            <p className="text-muted-foreground mb-2">If you have an active LaneBrief account, you can request deletion directly:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-2">
              <li>Log in to your account at <a href="https://lanebrief.com" className="text-primary hover:underline">lanebrief.com</a></li>
              <li>Navigate to <strong className="text-foreground">Account Settings</strong></li>
              <li>Select <strong className="text-foreground">Delete My Account</strong></li>
              <li>Confirm your request</li>
            </ol>
          </section>

          <hr className="border-border/40 mb-8" />

          {/* What gets deleted */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">What Gets Deleted</h2>
            <p className="text-muted-foreground mb-3">When you request data deletion, we will permanently remove:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Your account information (name, email address)</li>
              <li>Your freight lane selections and preferences</li>
              <li>Your rate benchmarking data and history</li>
              <li>Your carrier scoring queries</li>
              <li>Your subscription and billing records (except as required by law for tax/financial reporting)</li>
            </ul>
          </section>

          <hr className="border-border/40 mb-8" />

          {/* What we retain */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">What We May Retain</h2>
            <p className="text-muted-foreground mb-3">We may retain limited information as required by law or legitimate business purposes:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong className="text-foreground">Financial records</strong> required for tax and accounting compliance</li>
              <li><strong className="text-foreground">Anonymized, aggregated data</strong> that cannot be used to identify you</li>
              <li><strong className="text-foreground">Legal hold data</strong> if involved in an active dispute or legal proceeding</li>
            </ul>
          </section>

          <hr className="border-border/40 mb-8" />

          {/* Meta section */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Data Deletion for Meta (Facebook/Instagram) Users</h2>
            <p className="text-muted-foreground mb-3">
              If you connected to LaneBrief through a Meta (Facebook or Instagram) integration, you can also manage your data through Meta:
            </p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-2 mb-4">
              <li>
                Go to your{" "}
                <a
                  href="https://www.facebook.com/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Meta Settings &amp; Privacy
                </a>{" "}
                &gt; <strong className="text-foreground">Apps and Websites</strong>
              </li>
              <li>Find <strong className="text-foreground">LaneBrief</strong> and select <strong className="text-foreground">Remove</strong></li>
              <li>Check the box for <em>Delete all posts, photos, and videos on Facebook that LaneBrief may have published on your behalf</em></li>
              <li>Click <strong className="text-foreground">Remove</strong></li>
            </ol>
            <p className="text-muted-foreground">
              This will remove Meta-related data. To delete all LaneBrief account data, also submit a request using one of the methods above.
            </p>
          </section>

          <hr className="border-border/40 mb-8" />

          {/* Processing time */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Processing Time</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Data deletion requests are processed within <strong className="text-foreground">30 days</strong>.</li>
              <li>You will receive an email confirmation when deletion is complete.</li>
              <li>Some data may take up to <strong className="text-foreground">90 days</strong> to be fully purged from backup systems.</li>
            </ul>
          </section>

          <hr className="border-border/40 mb-8" />

          {/* Contact */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Contact</h2>
            <p className="text-muted-foreground">If you have questions about data deletion, contact us at:</p>
            <div className="mt-3 text-muted-foreground">
              <p className="font-semibold text-foreground">LaneBrief</p>
              <p>
                Email:{" "}
                <a href="mailto:intel@lanebrief.com" className="text-primary hover:underline">
                  intel@lanebrief.com
                </a>
              </p>
              <p>
                Website:{" "}
                <a href="https://lanebrief.com" className="text-primary hover:underline">
                  lanebrief.com
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 LaneBrief. All rights reserved.</p>
          <nav aria-label="Legal links" className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/data-deletion" className="hover:text-foreground transition-colors">Data Deletion</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
