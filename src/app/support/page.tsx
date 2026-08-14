import PublicPolicyPage from "@/components/PublicPolicyPage";

export const metadata = { title: "Support · War Room Pick'Em" };
export default function SupportPage() { return <PublicPolicyPage title="Support">
  <section><h2>Contact War Room</h2><p>Email <a className="text-primary underline" href="mailto:mike@war-room-picks.com?subject=War%20Room%20Support">mike@war-room-picks.com</a>. Include the screen you were on, what you expected, what happened, your device model, and—if relevant—the league name. Never send your password or authentication code.</p></section>
  <section><h2>Account and privacy requests</h2><p>Use the same address for account access, correction, deletion, or privacy questions. Send the request from the email connected to your War Room account so ownership can be verified.</p></section>
  <section><h2>Safety reports</h2><p>For a player or Locker issue, use Report on the player&apos;s profile when possible. For urgent service abuse, email support with “Safety” in the subject. Do not include unnecessary private information.</p></section>
  <section><h2>Scoring issues</h2><p>Include the sport, league, week, game, and the result you believe is incorrect. Do not create replacement picks or alter league records while the issue is being reviewed.</p></section>
</PublicPolicyPage>; }
