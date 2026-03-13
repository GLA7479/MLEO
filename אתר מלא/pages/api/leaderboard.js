// pages/api/leaderboard.js
let leaderboard = [];

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json(leaderboard);
  }

  if (req.method === "POST") {
    const { name, score } = req.body;
    if (!name || typeof score !== "number") {
      return res.status(400).json({ error: "Invalid data" });
    }

    const existing = leaderboard.find((p) => p.name === name);
    if (existing) {
      if (score > existing.score) existing.score = score;
    } else {
      leaderboard.push({ name, score });
    }

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 20);

    return res.status(200).json(leaderboard);
  }

  res.status(405).json({ error: "Method not allowed" });
}
