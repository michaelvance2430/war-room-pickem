/**
 * Generate War Room Pick'Em Executive Summary (Word).
 * Run: node docs/generate-executive-summary.mjs
 *
 * Narrative order (submission-friendly):
 *   1 Vision → 2 Problem → 3 Product → 4 How it plays →
 *   5 Longevity → 6 Capabilities → 7 Build status →
 *   8 Principles → 9 Path forward → Closing
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  BorderStyle,
  PageNumber,
  WidthType,
  Table,
  TableRow,
  TableCell,
  ShadingType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "War-Room-PickEm-Executive-Summary.docx");

const ACCENT = "1B5E20";
const MUTED = "555555";
const RULE = "CCCCCC";

const border = { style: BorderStyle.SINGLE, size: 1, color: RULE };
const borders = { top: border, bottom: border, left: border, right: border };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 4 },
    },
    children: [
      new TextRun({ text, font: "Arial", size: 28, bold: true, color: ACCENT }),
    ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 24,
        bold: true,
        color: "222222",
      }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function cell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill
      ? { fill: opts.fill, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: opts.size ?? 20,
            bold: opts.bold,
            color: opts.color,
          }),
        ],
      }),
    ],
  });
}

function bulletConfig(reference) {
  return {
    reference,
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: 720, hanging: 360 } },
        },
      },
    ],
  };
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "222222" },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      bulletConfig("b1"),
      bulletConfig("b2"),
      bulletConfig("b3"),
      bulletConfig("b4"),
      bulletConfig("b5"),
      bulletConfig("b6"),
      bulletConfig("b7"),
      bulletConfig("b8"),
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720, hanging: 360 } },
            },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: ACCENT,
                  space: 8,
                },
              },
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: "War Room Pick’Em  ·  Executive Summary",
                  font: "Arial",
                  size: 18,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: RULE,
                  space: 8,
                },
              },
              spacing: { before: 120 },
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Working draft  ·  College Football focus  ·  Page ",
                  font: "Arial",
                  size: 16,
                  color: MUTED,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 16,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // —— Title ——
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "WAR ROOM PICK’EM",
              font: "Arial",
              size: 40,
              bold: true,
              color: ACCENT,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Executive Summary",
              font: "Arial",
              size: 32,
              bold: true,
              color: "222222",
            }),
          ],
        }),
        p(
          "A private College Football friend-league platform built for joy, belonging, and seasons that people return to.",
          { size: 20, color: MUTED, after: 60 }
        ),
        p(
          "Working draft for future submission materials  ·  Focus: 2026–27 CFB season  ·  July 2026",
          { size: 18, italics: true, color: MUTED, after: 280 }
        ),

        // —— 1. Vision first (as requested) ——
        h1("1. Vision & Purpose"),
        p(
          "War Room Pick’Em begins with a human purpose: to bring joy and community into a world that often feels dark, scattered, and lonely. The product is an expression of care—an intentional digital place where people are not reduced to usernames or content metrics, but known as friends in a room with history, humor, and a reason to check in on one another."
        ),
        p(
          "College football is the shared language. It already carries ritual, rivalry, hope, and heartbreak. This platform aims that energy at something healthier than doomscrolling or empty notification loops: friendship, light competition, and the quiet comfort of knowing someone else is in the room with you—even when you are not in the same city."
        ),
        p(
          "The work is personal. It is not designed as a casino, a content farm, or a growth-at-all-costs social network. It is designed as a front porch for a friend league: a place where names matter, where seasons leave a scrapbook, where trash talk stays human, and where the host—the Commissioner—is supported rather than abandoned with a spreadsheet and a group chat that dies by Week 4."
        ),
        p(
          "Success is not merely “users.” Success is people who look forward to Saturday, text each other after a Best Bet hits, remember who called the national champion in August, and still want to open the room next year—because the room was built to hold them."
        ),

        // —— 2. The problem (sets up the product) ——
        h1("2. The Problem We Are Solving"),
        p(
          "Private sports leagues among friends already exist—in theory. In practice, they often fail for predictable reasons:"
        ),
        bullet(
          "Hosting is exhausting. One person becomes the unpaid operations staff of the friend group.",
          "b1"
        ),
        bullet(
          "Tools are either too corporate (cold, complex, money-first) or too thin (spreadsheets, dying chats).",
          "b1"
        ),
        bullet(
          "History evaporates. Without memory—hardware, lore, names—next season feels like starting from zero.",
          "b1"
        ),
        bullet(
          "Half the room is discarded midseason. When only the top half still has a story, the rest mutes the chat.",
          "b1"
        ),
        bullet(
          "Loneliness is the ambient condition. People want belonging; they are offered feeds instead of rooms.",
          "b1"
        ),
        p(
          "War Room Pick’Em answers those failures with product design, not slogans: a weekly ritual that is fun to run, a season structure that keeps everyone in a story, and memory systems that make returning next year feel continuous with this one."
        ),

        // —— 3. Product definition ——
        h1("3. The Product"),
        p(
          "War Room Pick’Em is a mobile-first web application for private College Football pick’em leagues among friends and small communities. Each week, the Commissioner publishes a five-game Against-The-Spread card with confidence scoring, a Best Bet, and a weekly prop. Players lock picks. Results feed standings, power rankings, and—later—dual postseason brackets."
        ),
        p(
          "Scope of this summary is College Football only. Depth in one sport—one calendar, one culture, one coherent set of rules—is preferred over a shallow multi-sport surface. Expansion can be considered later; longevity starts with doing CFB with care."
        ),

        // —— 4. How it plays ——
        h1("4. How the Game Plays"),
        h2("4.1 Weekly rhythm"),
        bullet(
          "Commissioner builds a five-game card from live FBS lines (with pre-season practice tools available before doors open).",
          "b2"
        ),
        bullet(
          "Players pick each side Against The Spread, assign confidence points 1–5 (each used once), choose one Best Bet, and answer a weekly prop.",
          "b2"
        ),
        bullet(
          "A correct Best Bet doubles that game’s confidence value; a correct prop awards bonus points.",
          "b2"
        ),
        bullet(
          "After finals, the Commissioner syncs or enters results. Standings and room activity update. The loop repeats.",
          "b2"
        ),

        h2("4.2 Season arc"),
        bullet(
          "Regular season: cumulative points plus Power Rankings that emphasize recent form—not only season totals.",
          "b3"
        ),
        bullet(
          "Cut: typically the bottom half of each division (cut percent configurable) separates contenders from chaos.",
          "b3"
        ),
        bullet(
          "Championship Bracket: top half, performance seeding, single elimination; division winners locked into premium seeds.",
          "b3"
        ),
        bullet(
          "Toilet Bowl: bottom half, inverted seeding, same weekly card—maximum camaraderie for players who would otherwise disappear.",
          "b3"
        ),
        bullet(
          "Crystal Ball: free preseason national champion pick—zero standings points, pure pride—locked when the season freezes.",
          "b3"
        ),

        h2("4.3 Roles in the room"),
        bullet(
          "Players pick, talk, chase badges, and build season memory.",
          "b4"
        ),
        bullet(
          "Commissioner (and optional deputies) invite members, publish cards, chase missing picks, score weeks, and guard fairness.",
          "b4"
        ),
        bullet(
          "A guest/practice path lets people feel the product before a full friend group commits.",
          "b4"
        ),

        // —— 5. Longevity before feature dump (strategic "so what") ——
        h1("5. Longevity: Why People Stay"),
        p(
          "Longevity is the design problem, not a later marketing chapter. Friend leagues die when hosting burns out, when history vanishes, when latecomers feel lost, or when only grind remains. The product is built to counter each of those failure modes."
        ),

        h2("5.1 A ritual that returns every week"),
        p(
          "Card → picks → banter → results is a calendar habit. Confidence scoring and Best Bets make every slip personal. Props and ranked-game theater give people something to argue about even when they are not football experts. Ritual creates return visits; return visits create community."
        ),

        h2("5.2 Memory that compounds across seasons"),
        p(
          "Career badges, permanent hardware, Crystal Ball lore, and named legends turn one season into a scrapbook. When next August arrives, players are not starting from zero emotionally—they are defending a reputation, chasing a badge they almost earned, or roasting the same friend who always fades after October."
        ),

        h2("5.3 Dual stakes, dual stories"),
        p(
          "Championship and Toilet Bowl give every tier of the room a postseason narrative. Half the league is not discarded; they are promoted into a different kind of glory. Engagement stays high for people who would otherwise mute the chat after a bad September."
        ),

        h2("5.4 Host sustainability"),
        p(
          "The Commissioner is the single point of failure in most private leagues. First-time onboarding, practice tools for learning the host role, deputies, missing-pick tools, and clear scoring workflows exist so hosting remains an act of care—not a part-time job that burns people out by midseason."
        ),

        h2("5.5 Integrity of the real season"),
        p(
          "Practice tools exist to teach. Live season tools exist to protect trust. Demo cards, trial bots, and auto-score runs do not masquerade as real competition once doors open. That boundary preserves fairness, the meaning of career hardware, and the emotional weight of a true season."
        ),

        h2("5.6 Human-scale community"),
        p(
          "Private leagues, invite codes, name-forward profiles, announcements, and locker signals keep the product at human scale. Longevity is measured in relationships retained year over year—not in anonymous traffic charts. The right growth is more rooms of people who know each other."
        ),

        // —— 6. Capabilities as evidence of the thesis ——
        h1("6. Capabilities Built to Serve That Purpose"),
        p(
          "Features are listed here as evidence of the vision and longevity thesis—not as an exhaustive engineering changelog. Scope remains College Football."
        ),

        h2("6.1 Belonging & first experience"),
        bullet(
          "Join codes and league hosting so a friend group can stand up a private room quickly.",
          "b5"
        ),
        bullet(
          "Guest demo mode and a player walkthrough covering Crystal Ball and weekly picks in plain language.",
          "b5"
        ),
        bullet(
          "First-time Commissioner path: checklist, first-card wizard, and practice tools that teach the host role before real lines matter.",
          "b5"
        ),
        bullet(
          "Home unseen pulses for announcements and locker activity so people know when the room is alive.",
          "b5"
        ),

        h2("6.2 Weekly competition"),
        bullet(
          "Five-game ATS card with confidence points, Best Bet, and weekly prop (presets or custom).",
          "b6"
        ),
        bullet(
          "Live odds pull for FBS matchups, ranked-game highlighting (Top 10 / Top 25), and clear kickoff grouping.",
          "b6"
        ),
        bullet(
          "Pick submission status (“Who’s in”), missing-pick announcements, and a player week checklist on Home.",
          "b6"
        ),
        bullet(
          "Score sync from finals plus locked week results so re-scoring is intentional, not accidental.",
          "b6"
        ),

        h2("6.3 Season theater & memory"),
        bullet(
          "Standings, Power Rankings, and dual brackets (Championship + Toilet Bowl).",
          "b7"
        ),
        bullet(
          "Crystal Ball national champion pick with lock rules and light room-native moments for missed free flexes.",
          "b7"
        ),
        bullet(
          "Seasonal badges and career achievements; Trophy Room hardware for Championship, Toilet Bowl, and Crystal Ball (Village Nerd).",
          "b7"
        ),
        bullet(
          "Legacy recognition (War Room Legend pathway) so prior-season standouts remain part of the room’s story.",
          "b7"
        ),
        bullet(
          "Season themes and league identity (name, tagline, visual theme) so each league feels like their room.",
          "b7"
        ),

        h2("6.4 Commissioner operations"),
        bullet(
          "Commissioner Tools: Build Card, Who’s In, Enter Results, Settings—plus deputies and commissioner transfer.",
          "b8"
        ),
        bullet(
          "View-as-player mode with clear exit controls so hosts experience the league as members do.",
          "b8"
        ),
        bullet(
          "Pre-season practice toolkit: one-tap demo week publish, trial bots, randomize-and-score, and auto-score ranges for learning with minimal clicks.",
          "b8"
        ),
        bullet(
          "After season open, demo/bot auto-run tools lock with a clear explanation that they were for training—not live play. Clear bots remains for cleanup.",
          "b8"
        ),
        bullet(
          "Mobile-first craft: large taps, intentional pull-to-refresh, profile links that read as people. Feedback channel so the builder stays reachable.",
          "b8"
        ),

        // —— 7. Status table ——
        h1("7. Current Build Status"),
        p(
          "Snapshot of major capability delivered in the current development arc (executive view, not a full changelog)."
        ),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [3000, 7080],
          rows: [
            new TableRow({
              children: [
                cell("Domain", 3000, {
                  bold: true,
                  fill: "E8F5E9",
                  color: ACCENT,
                }),
                cell("Delivered capability", 7080, {
                  bold: true,
                  fill: "E8F5E9",
                  color: ACCENT,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("Hosting & onboarding", 3000, { bold: true }),
                cell(
                  "First-time Commish checklist/wizard; player tutorial; guest demo; invite path; Home unseen counts",
                  7080
                ),
              ],
            }),
            new TableRow({
              children: [
                cell("Weekly card & picks", 3000, { bold: true }),
                cell(
                  "Odds pull, ranked matchup highlights, confidence/Best Bet/prop, mobile prop UX, pick status & nudges",
                  7080
                ),
              ],
            }),
            new TableRow({
              children: [
                cell("Scoring & season ops", 3000, { bold: true }),
                cell(
                  "Results entry, score sync, week locks, auto-advance, sandbox auto-score ranges, one-tap demo publish / randomize+score",
                  7080
                ),
              ],
            }),
            new TableRow({
              children: [
                cell("Sandbox vs real season", 3000, { bold: true }),
                cell(
                  "Sandbox career/trophy rules; practice-tool lock after season open with Commish explanation; season-open readiness",
                  7080
                ),
              ],
            }),
            new TableRow({
              children: [
                cell("Identity & memory", 3000, { bold: true }),
                cell(
                  "Badges & career cheevos, Trophy Room, Crystal Ball locks, legends/hardware, season themes",
                  7080
                ),
              ],
            }),
            new TableRow({
              children: [
                cell("Room culture", 3000, { bold: true }),
                cell(
                  "Announcements, room-native moments, player name links, pull-to-refresh, dual role (Commish / view as player)",
                  7080
                ),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 200 }, children: [] }),

        // —— 8. Principles (short, after evidence) ——
        h1("8. Design Principles"),
        bullet(
          "Joy before grind: the default emotional tone is play, not pressure.",
          "numbers"
        ),
        bullet(
          "People over features: every feature should make someone feel seen, included, or lightly roasted with love.",
          "numbers"
        ),
        bullet(
          "Keep it simple, then go deep: short paths for first use; advanced power without cluttering the first hour.",
          "numbers"
        ),
        bullet(
          "Respect the host: if the Commissioner is miserable, the league dies.",
          "numbers"
        ),
        bullet(
          "Protect real-season meaning: practice hard, play clean when it counts.",
          "numbers"
        ),
        bullet(
          "College Football first: one sport, one calendar, one culture—done with care.",
          "numbers"
        ),

        // —— 9. Path forward ——
        h1("9. Near-Term Path (2026–27)"),
        p(
          "Immediate priority is a healthy, livable College Football season for real friend leagues: stable weekly operations, clear onboarding, trustworthy scoring, and memory systems that make next year feel continuous with this one."
        ),
        p(
          "Pre-season is for rehearsal—demo weeks, trial fields, and learning the host role. After season open, the product centers live lines, real picks, and real results. Success is measured in rooms that are still talking in January—and still eager in August."
        ),

        // —— Closing ——
        h1("10. Closing"),
        p(
          "War Room Pick’Em is a bet that software can still be a vessel for care. In a dark and lonely world, a shared Saturday ritual—with names, history, humor, and a host who is not alone—can be a small light people return to."
        ),
        p(
          "This document is a living executive draft. It is meant to orient future submission materials around purpose first, product second, and longevity always. College Football is the present chapter. Community is the constant."
        ),
        p("— End of Executive Summary —", {
          align: AlignmentType.CENTER,
          italics: true,
          color: MUTED,
          before: 360,
          after: 80,
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log("Wrote", outPath);
