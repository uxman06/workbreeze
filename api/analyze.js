import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple in-memory rate limiter: max 20 requests per IP per hour
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 20;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap
    .get(ip)
    .filter((t) => now - t < windowMs);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  return timestamps.length > maxRequests;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Rate limiting
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: "Too many requests. Please wait before trying again.",
    });
  }

  const { fileContent, fileName, fileType, prompt, outputType } = req.body;

  // Basic validation
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({ error: "Prompt is too long." });
  }

  if (!fileContent && !fileName) {
    return res.status(400).json({ error: "No file data provided." });
  }

  // Build output-specific instructions
  const outputInstructions =
    {
      summary:
        "Write a clear business summary in plain prose paragraphs. No markdown headers. Be concise and actionable.",
      chart:
        'Write a short analysis paragraph, then output a JSON block wrapped in ```json containing: {"chartType":"bar"|"line"|"pie","title":"...","labels":[...],"datasets":[{"label":"...","data":[...]}]}. Make the chart data meaningful.',
      excel:
        "Write a clear analysis. Include a plain-text data table where useful.",
      word: "Write a formal business report with these sections: Executive Summary, Key Findings, Recommendations.",
    }[outputType] || "Write a clear, concise business analysis.";

  const systemPrompt = `You are WorkBreeze, a practical business analyst AI for small teams. Analyze the uploaded file content and answer the user's question clearly and usefully.

${outputInstructions}

Write in plain, readable English. Be specific with numbers and names from the data. Avoid filler phrases.`;

  const userMessage = `File: ${fileName} (${fileType?.toUpperCase()})

File content:
${fileContent || "[File content could not be extracted]"}

Request: ${prompt}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return res.status(200).json({ result: text });
  } catch (err) {
    console.error("Anthropic API error:", err);

    if (err.status === 401) {
      return res
        .status(500)
        .json({ error: "API key is invalid. Check your environment variables." });
    }
    if (err.status === 429) {
      return res
        .status(429)
        .json({ error: "AI service is busy. Please try again in a moment." });
    }

    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
