import PublicPolicyPage from "@/components/PublicPolicyPage";

export const metadata = { title: "Community Standards · War Room Pick'Em" };
export default function CommunityPage() { return <PublicPolicyPage title="Community Standards">
  <section><h2>Trash talk has a line</h2><p>Competitive jokes, rivalries, and bad-beat complaints belong here. Threats, targeted harassment, hate speech, sexual exploitation, stalking, doxxing, and encouragement of real-world harm do not.</p></section>
  <section><h2>Keep people and content safe</h2><ul><li>Do not share private contact, financial, location, or identity information.</li><li>Do not post illegal, graphic, sexually explicit, or rights-infringing content.</li><li>Do not spam, scam, impersonate, or manipulate other players.</li><li>Do not use War Room to organize gambling or collect wagers.</li></ul></section>
  <section><h2>Report, block, moderate</h2><p>Use a player profile to report or block someone. Blocking hides that player&apos;s Locker posts from you. Reports go privately to authorized league staff. Commissioners and moderators can remove posts, mute Locker access, or remove members. Serious or repeated violations may be escalated to War Room support.</p></section>
  <section><h2>Immediate danger</h2><p>War Room support is not an emergency service. If someone may be in immediate danger, contact local emergency services or an appropriate safety authority.</p></section>
</PublicPolicyPage>; }
