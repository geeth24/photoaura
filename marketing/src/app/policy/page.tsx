import Link from 'next/link';
import React from 'react';

function Page() {
  return (
    <div className="relative isolate flex  flex-col items-center justify-center text-primary">
      <div className="max-w-3xl px-6 pb-20 pt-32">
        <h1 className="mb-4 text-2xl font-semibold">Privacy Policy for PhotoAura</h1>
        <p className="mb-4 text-base">Last updated: February 2, 2024</p>
        <h2 className="mb-2 text-xl font-semibold">Introduction</h2>
        <p className="mb-4 text-base text-primary/50">
          Welcome to PhotoAura, an app developed by Rad Soft, Inc. (&quot;we,&quot; &quot;our,&quot;
          or &quot;us&quot;). At PhotoAura, we value your privacy and are committed to protecting
          your personal information. This Privacy Policy outlines our practices regarding the
          collection, use, and sharing of user data when you use our mobile application (the
          &quot;App&quot;). Please read this Privacy Policy carefully to understand how we handle
          your information.
        </p>
        <h2 className="mb-2 text-xl font-semibold">Information We Collect</h2>
        <p className="mb-4 text-base">
          PhotoAura is designed to let users organize, edit, and share your photos from a single
          place privately and deploys on your own It&apos;s a self-hosted, open-source.
        </p>
        <ul className="mb-4 list-inside list-disc">
          <div>
            <p>
              Self-Hosted:{' '}
              <span className="text-primary/50">
                As a self-hosted app, PhotoAura does not collect or store any personal information
                about you. All your photos and data are stored on your
              </span>
            </p>
          </div>
        </ul>
        <h2 className="mb-2 text-xl font-semibold">How We Use Your Information</h2>
        <p className="mb-4 text-base text-primary/50">
          We do not collect any of information about you. We do not use any of your information.
        </p>
        <h2 className="mb-2 text-xl font-semibold">Data Sharing</h2>
        <p className="mb-4 text-base text-primary/50">
          We do not sell, trade, or share your personal information with third parties for marketing
          or advertising purposes.
        </p>
        <h2 className="mb-2 text-xl font-semibold">Legal Compliance</h2>
        <p className="mb-4 text-base text-primary/50">
          PhotoAura complies with all applicable data protection and privacy laws and regulations in
          the countries where the App is available. We will cooperate with law enforcement agencies
          and other governmental organizations when required to do so by law.
        </p>
        <h2 className="mb-2 text-xl font-semibold">Security</h2>
        <p className="mb-4 text-base text-primary/50">
          We take reasonable measures to protect the information collected through the App. However,
          no data transmission over the internet is completely secure, and we cannot guarantee the
          absolute security of your data.
        </p>
        <h2 className="mb-2 text-xl font-semibold">Changes to this Privacy Policy</h2>
        <p className="mb-4 text-base text-primary/50">
          We may update this Privacy Policy from time to time to reflect changes in our practices or
          for other operational, legal, or regulatory reasons. We will post the revised Privacy
          Policy on our website and update the &quot;Last updated&quot; date.
        </p>
        <h2 className="mb-2 text-xl font-semibold">Contact Us</h2>
        <p className="mb-4 text-base text-primary/50">
          If you have any questions, concerns, or requests regarding this Privacy Policy or your
          personal data, please feel free to contact us at:
        </p>
        <p className="mb-4 text-base ">
          Rad Soft, Inc.
          <br />
          Coppell, TX 75019
          <br />
          Email: <Link href="mailto:info@radsoftinc.com">info@radsoftinc.com</Link>
          <br />
          Support Email: <Link href="mailto:support@PhotoAura.app">info@radsoftinc.com</Link>
        </p>
        <p className="text-base">
          Thank you for using PhotoAura. Your privacy and trust are important to us.
        </p>
      </div>
    </div>
  );
}

export default Page;
