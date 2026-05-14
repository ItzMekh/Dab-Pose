import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentDefinition, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const API_URL = process.env.DAB_POSE_API_URL ?? "https://dabpose.fun";

const systemPrompt = `You are the Dab Pose Assistant — an AI agent for the Dab Pose game (${API_URL}).

Dab Pose is a browser-based pose detection speed game where players dab as fast as possible after a green signal.
Two modes:
- Reflex Dab (single): fastest single reaction time in milliseconds — lower is better
- Dab Rush (streak): most dabs in 30 seconds — higher is better

API endpoints:
- GET ${API_URL}/api/leaderboard?mode=single|streak&period=all|week|today — top scores
- GET ${API_URL}/api/stats — total play count
- POST ${API_URL}/api/score — submit a score (username, time_ms/count, mode)

Username rules: 1–20 chars, only letters/numbers/underscores/hyphens/spaces (/^[a-zA-Z0-9_\\- ]{1,20}$/)
Score rules: time_ms must be 100–30000ms; count must be 0–300

Use your subagents for specialized tasks:
- leaderboard-analyst: for fetching and analyzing leaderboard data
- username-moderator: for validating and checking usernames
- game-assistant: for answering gameplay questions and tips`;

const agents: Record<string, AgentDefinition> = {
  "leaderboard-analyst": {
    description: "Fetches and analyzes Dab Pose leaderboard data. Use for queries about scores, rankings, top players, and statistics.",
    prompt: `You are a leaderboard analyst for Dab Pose (${API_URL}).
Fetch leaderboard data using WebFetch and analyze it.
- Single mode (Reflex Dab): scores ordered by time_ms ASC — lower ms = faster = better
- Streak mode (Dab Rush): scores ordered by count DESC — more dabs = better
- Periods: all (all-time), week (this week), today (today only)
- Rank #1 is the "King Dab" — look for the 👑 title in context
Always provide clear, formatted output with rankings, times/counts, and insights.`,
    tools: ["WebFetch"],
  },

  "username-moderator": {
    description: "Validates Dab Pose usernames against game rules and checks for inappropriate content. Use before a player submits their score.",
    prompt: `You are a username moderator for Dab Pose.
Validate usernames against these rules:
1. Length: 1–20 characters
2. Allowed chars: letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-), spaces
3. Must match: /^[a-zA-Z0-9_\\- ]{1,20}$/
4. Must not contain offensive, hateful, or inappropriate content

For each username, respond with:
- VALID or INVALID
- Reason if invalid
- Suggested alternatives if invalid due to content`,
    tools: [],
  },

  "game-assistant": {
    description: "Answers questions about how to play Dab Pose, tips for improving reaction time, and general game information.",
    prompt: `You are a helpful game assistant for Dab Pose — a browser-based pose detection speed game.

Game facts:
- Players dab (raise one arm straight, other arm bent near face) as fast as possible after a green signal
- Reflex Dab: race against the signal — fastest single reaction wins. Anti-cheat: raising your arm before the signal resets the timer.
- Dab Rush: 30 seconds — dab as many times as possible
- Pose detection uses MediaPipe Holistic — requires a webcam and good lighting
- Detection requires 3 consecutive confirmed frames to register a dab (prevents false positives)
- The "dabArm" is the raised/extended arm — NOT the bent arm near the face

Tips for faster reactions:
- Keep arms relaxed and in ready position (not pre-raised — that triggers anti-cheat)
- Good lighting helps pose detection register faster
- Practice the motion to build muscle memory
- The signal timing is random to prevent anticipation

Be friendly, concise, and helpful.`,
    tools: ["WebFetch"],
  },
};

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ");

  if (!prompt) {
    console.log("Usage: npm start -- \"<your question or task>\"");
    console.log("\nExamples:");
    console.log('  npm start -- "Show me the top 5 Reflex Dab scores today"');
    console.log('  npm start -- "Is the username DabKing123 valid?"');
    console.log('  npm start -- "How do I get a faster reaction time?"');
    console.log('  npm start -- "Compare this week leaderboard for both modes"');
    process.exit(0);
  }

  console.log(`\nDab Pose Agent\n${"─".repeat(40)}`);
  console.log(`Prompt: ${prompt}\n`);

  for await (const message of query({
    prompt,
    options: {
      systemPrompt,
      allowedTools: ["WebFetch", "Bash", "Agent"],
      agents,
      maxTurns: 15,
      permissionMode: "dontAsk",
    },
  })) {
    handleMessage(message);
  }
}

function handleMessage(message: SDKMessage): void {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text.trim()) {
        process.stdout.write(block.text);
      }
    }
  } else if (message.type === "result") {
    if (message.subtype === "success") {
      console.log(`\n${"─".repeat(40)}`);
      console.log(`Done — ${message.num_turns} turn(s), ~$${message.total_cost_usd.toFixed(4)}`);
    } else {
      console.error(`\nError: ${message.subtype}`);
    }
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
