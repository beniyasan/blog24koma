export type Language = 'ja' | 'en';

export function normalizeLanguage(value: unknown): Language {
    if (value === 'en' || value === 'ja') return value;
    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (lower === 'en' || lower === 'ja') return lower;
    }
    return 'ja';
}

export function getStoryboardSystemPrompt(language: Language): string {
    if (language === 'en') {
        return `You are a 4-panel manga (yonkoma) scriptwriter. Convert the given article into a 4-panel storyboard.

Constraints:
- Exactly 4 panels (setup, development, twist, punchline)
- Each panel must include description (a concrete, drawable scene; ~50-120 characters) and dialogue (short and memorable; <= 50 characters)
- Dialogue must be in English
- Convey the article's core message in 4 panels

Output format:
Return ONLY the following JSON array. Do not add any extra text.
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`;
    }

    return `あなたは4コマ漫画の脚本家です。与えられた記事の内容を4コマ漫画の絵コンテに変換してください。

制約:
- 必ず4つのパネル（起承転結）で構成する
- 各パネルには description（シーンの説明）と dialogue（セリフ）を含める
- description は視覚的に描画可能な具体的な場面を記述する（50-100文字）
- dialogue は短く印象的なセリフにする（30文字以内）
- 記事の核心的なメッセージを4コマで伝える

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`;
}

export interface StoryboardPanelLike {
    panel: 1 | 2 | 3 | 4;
    description: string;
    dialogue: string;
}

export function getImagePrompt(language: Language, storyboard: StoryboardPanelLike[]): string {
    if (language === 'en') {
        const panelDescriptions = storyboard
            .map(
                (panel) =>
                    `[Panel ${panel.panel}]\nScene: ${panel.description}\nDialogue: "${panel.dialogue}"`
            )
            .join('\n\n');

        return `Generate a Japanese-style 4-panel comic as a single image.

[Layout]
- 4 vertical panels (top to bottom: 1 → 2 → 3 → 4)
- Same size panels with clear borders
- Tall aspect ratio (about 1:2)

[Style]
- Simple, cute 4-panel manga style
- Bright and friendly tone
- Chibi/cute character proportions
- Simple backgrounds

[Important]
- Show dialogue inside speech bubbles within each panel
- Dialogue must be in English with a readable font
- Keep the classic setup→punchline flow

[Panels]
${panelDescriptions}`;
    }

    const panelDescriptions = storyboard
        .map(
            (panel) =>
                `【コマ${panel.panel}】\nシーン: ${panel.description}\nセリフ: 「${panel.dialogue}」`
        )
        .join('\n\n');

    return `日本の4コマ漫画を1枚の画像として生成してください。

【レイアウト】
- 縦に4コマ並べた構成（上から下へ1→2→3→4の順）
- 各コマは同じサイズで、明確な枠線で区切る
- アスペクト比は縦長（1:2程度）

【スタイル】
- シンプルでかわいい日本の4コマ漫画風
- 明るく親しみやすいトーン
- キャラクターはデフォルメされたかわいいスタイル
- 背景はシンプルに

【重要】
- 各コマ内にセリフを吹き出しで表示すること
- セリフは日本語で、読みやすいフォントで描くこと
- 起承転結の流れを意識した構成

【各コマの内容】
${panelDescriptions}`;
}
