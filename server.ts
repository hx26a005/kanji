import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for Kanji Explanation
app.post("/api/kanji/explain", async (req, res) => {
  const { kanji, reading, type, question, context } = req.body;

  if (!kanji) {
    return res.status(400).json({ error: "漢字が指定されていません。" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      // Fallback fallback response for demo with no API key configured
      return res.json({
        success: true,
        isDemo: true,
        markdown: `### 🏫 AI先生の漢字解説（デモモード）
※現在、右上の「Settings > Secrets」に \`GEMINI_API_KEY\` が設定されていないため、自動作成されたサンプル解説を表示しています。

**漢字**: 【${kanji}】
**読み方**: （${reading || "読みの確認"}）

**部首・意味**:
「${kanji}」は国語の学習において非常に重要で、テストや日常会話でも頻繁に使われる漢字です。

**きれいに書くポイント**:
一画ずつ丁寧に、ハネ、ハライ、トメを意識して、文字のバランス（中心線など）を意識して書きましょう。

**実用的な例文**:
1. 毎日「${kanji}」の勉強をがんばる。
2. この言葉には深い意味がある。

💡 **覚え方のコツ**:
何度も実際に書いて、目と手と声（発音）を連動させながら練習すると、脳にしっかりと定着しますよ！
`,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `国語のプロの漢字先生として、漢字「${kanji}」について、小学生から一般の学習者まで誰にでも分かりやすく、温かい口調で詳しく解説してください。
問題の文脈：
- クイズでの読みや表記： ${reading || "不明"} (${type || "読み/書き"})
- 出題された問題： "${question || ""}"
- 文脈/補足： "${context || ""}"

以下の構成に従って、マークダウン（Markdown）形式で丁寧に出力してください（装飾や絵文字を使って親しみやすく）：

1. **漢字紹介**: 大きく「${kanji}」を提示し、全体の印象を伝える
2. **読み方**: 音読み・訓読みをはっきりと示す
3. **部首と画数**: 部首（読み方と意味）および総画数
4. **漢字の意味**: どのような成り立ち、またはどのような意味を持つか分かりやすく解説
5. **書き順・きれいに書くコツ**: 特に間違えやすい部分（ハネ、ハライ、交差など）のアドバイス
6. **実用的な例文（3つ）**: 日常生活やテストでよく使う例文（漢字には適宜ふりがなをカッコ書きで付ける）
7. **覚え方のコツ・アドバイス**: ゴロ合わせ、構成パーツの組み合わせ、イメージなど、記憶に残るユニークな覚え方を提案

最後には「がんばるあなたを応援しています！」といった温かい励ましの言葉を一言添えてください。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const markdown = response.text || "解説を生成できませんでした。";
    res.json({
      success: true,
      markdown,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: "AI解説の生成中にエラーが発生しました。時間を置いて再度お試しください。",
      details: error.message,
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
