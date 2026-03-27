// Simple in-memory rate limiter: max 20 requests per IP per hour
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 20;
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const timestamps = rateLimitMap.get(ip).filter((t) => now - t < windowMs);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return timestamps.length > maxRequests;
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

const MODELS = {
  "gemini-flash":  "google/gemini-flash-1.5",
  "gemini-pro":    "google/gemini-pro-1.5",
  "gpt-4o-mini":   "openai/gpt-4o-mini",
  "gpt-4o":        "openai/gpt-4o",
  "claude-sonnet": "anthropic/claude-sonnet-4-5",
  "claude-haiku":  "anthropic/claude-haiku-3-5",
};

const DEFAULT_MODEL = "gemini-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests. Please wait before trying again." });

  const { fileContent, fileName, fileType, prompt, outputType, model: modelKey } = req.body;

  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required." });
  if (prompt.length > 2000) return res.status(400).json({ error: "Prompt is too long." });
  if (!fileContent && !fileName) return res.status(400).json({ error: "No file data provided." });

  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];

  const outputInstructions = {
    summary: "Write a clear business summary in plain prose paragraphs. No markdown headers. Be concise and actionable.",
    chart:   'Write a short analysis paragraph, then output a JSON block wrapped in ```json containing: {"chartType":"bar"|"line"|"pie","title":"...","labels":[...],"datasets":[{"label":"...","data":[...]}]}. Make the chart data meaningful.',
    excel:   "Write a clear analysis. Include a plain-text data table where useful.",
    word:    "Write a formal business report: Executive Summary, Key Findings, Recommendations.",
  }[outputType] || "Write a clear, concise business analysis.";

  const systemPrompt = `You are WorkBreeze, a practical business analyst AI for small teams. Analyze the uploaded file content and answer the user's question clearly and usefully.\n\n${outputInstructions}\n\nWrite in plain, readable English. Be specific with numbers and names from the data. Avoid filler phrases.`;

  const userMessage = `File: ${fileName} (${fileType?.toUpperCase()})\n\nFile content:\n${fileContent || "[File content could not be extracted]"}\n\nRequest: ${prompt}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://workbreeze.vercel.app",
        "X-Title": "WorkBreeze",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage  },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter error:", data);
      return res.status(500).json({ error: data.error?.message || "AI request failed." });
    }

    const text = data.choices?.[0]?.message?.content || "No response received.";
    return res.status(200).json({ result: text, model });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
