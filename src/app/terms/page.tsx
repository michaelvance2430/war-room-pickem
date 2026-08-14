import PublicPolicyPage from "@/components/PublicPolicyPage";

export const metadata = { title: "Terms · War Room Pick'Em" };
export default function TermsPage() { return <PublicPolicyPage title="Terms of Use">
  <section><h2>The service</h2><p>War Room Pick&apos;Em is an entertainment product for private sports-prediction leagues. It does not offer real-money gambling, wagering, prizes of monetary value, or financial advice.</p></section>
  <section><h2>Your account</h2><p>You are responsible for your account, device access, and activity. Provide accurate information, protect your credentials, and do not impersonate another person. You must be legally able to use the service where you live.</p></section>
  <section><h2>Fair play</h2><p>Do not exploit bugs, manipulate picks after lock, access another player&apos;s private information, automate abusive traffic, or interfere with scoring. Commissioners must apply league rules consistently. War Room may correct technical scoring errors while preserving an audit trail.</p></section>
  <section><h2>Your content</h2><p>You retain ownership of content you submit. You grant War Room the limited permission needed to store, display, moderate, and transmit it within the service. Do not submit unlawful, threatening, hateful, harassing, sexually exploitative, infringing, or deceptive content.</p></section>
  <section><h2>Enforcement and availability</h2><p>Content may be removed and accounts or league access may be restricted for safety, abuse, cheating, legal compliance, or service protection. Features may change, pause, or end. The service is provided without a promise of uninterrupted availability.</p></section>
  <section><h2>Contact</h2><p>Questions or disputes should first be sent to <a className="text-primary underline" href="mailto:mike@war-room-picks.com">mike@war-room-picks.com</a> so they can be addressed directly.</p></section>
</PublicPolicyPage>; }
