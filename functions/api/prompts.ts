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
        return `You are a 4-panel manga (yonkoma) scriptwriter. Convert the given content into a 4-panel storyboard.

Constraints:
- Exactly 4 panels (setup, development, twist, punchline)
- First, define 1-4 characters with name and brief visual description
- Each panel has description (drawable scene; 50-120 chars) and dialogues array
- Each dialogue line has speaker (character name) and text (<=50 chars)
- A panel may have 0-3 dialogue lines
- Convey the core message in 4 panels

Output format:
Return ONLY the following JSON. Do not add any extra text.
{
  "characters": [
    {"name": "Alice", "description": "Young woman with short black hair, cheerful expression"},
    {"name": "Bob", "description": "Middle-aged man with glasses, serious look"}
  ],
  "storyboard": [
    {"panel": 1, "description": "...", "dialogues": [{"speaker": "Alice", "text": "..."}]},
    {"panel": 2, "description": "...", "dialogues": [{"speaker": "Bob", "text": "..."}, {"speaker": "Alice", "text": "..."}]},
    {"panel": 3, "description": "...", "dialogues": [{"speaker": "Alice", "text": "..."}]},
    {"panel": 4, "description": "...", "dialogues": []}
  ]
}`;
    }

    return `あなたは4コマ漫画の脚本家です。与えられた内容を4コマ漫画の絵コンテに変換してください。

制約:
- 必ず4つのパネル（起承転結）で構成する
- まず登場人物を1〜4人定義する（名前と外見の特徴）
- 各パネルには description（シーンの説明）と dialogues（セリフ配列）を含める
- description は視覚的に描画可能な具体的な場面を記述する（50-100文字）
- 各セリフには speaker（話者名）と text（セリフ本文、30文字以内）を含める
- 1コマあたりのセリフは0〜3個
- 内容の核心的なメッセージを4コマで伝える

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
{
  "characters": [
    {"name": "太郎", "description": "20代の男性会社員、黒髪短髪、真面目な表情"},
    {"name": "花子", "description": "20代の女性、ポニーテール、明るい笑顔"}
  ],
  "storyboard": [
    {"panel": 1, "description": "...", "dialogues": [{"speaker": "太郎", "text": "..."}]},
    {"panel": 2, "description": "...", "dialogues": [{"speaker": "花子", "text": "..."}, {"speaker": "太郎", "text": "..."}]},
    {"panel": 3, "description": "...", "dialogues": [{"speaker": "太郎", "text": "..."}]},
    {"panel": 4, "description": "...", "dialogues": []}
  ]
}`;
}

export interface StoryboardPanelLike {
    panel: 1 | 2 | 3 | 4;
    description: string;
    dialogue: string;
}

interface CharacterLike {
    name: string;
    description?: string;
}

export function getImagePrompt(
    language: Language,
    storyboard: StoryboardPanelLike[],
    options: { characters?: CharacterLike[] } = {}
): string {
    if (language === 'en') {
        const charactersSection = (options.characters || [])
            .map((c) => ({ name: (c.name || '').trim(), description: (c.description || '').trim() }))
            .filter((c) => c.name)
            .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
            .join('\n');

        const panelDescriptions = storyboard
            .map(
                (panel) =>
                    `[Panel ${panel.panel}]\nScene: ${panel.description}\nDialogue:\n${panel.dialogue}`
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
- If multiple dialogue lines are provided, render them as separate speech bubbles (keep speaker names if included)
- If a panel has no dialogue, you may omit speech bubbles for that panel
- Keep the classic setup→punchline flow

${charactersSection ? `[Characters]\n${charactersSection}\n` : ''}

[Panels]
${panelDescriptions}`;
    }

    const charactersSection = (options.characters || [])
        .map((c) => ({ name: (c.name || '').trim(), description: (c.description || '').trim() }))
        .filter((c) => c.name)
        .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
        .join('\n');

    const panelDescriptions = storyboard
        .map(
            (panel) =>
                `【コマ${panel.panel}】\nシーン: ${panel.description}\nセリフ:\n${panel.dialogue}`
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
- セリフが複数行ある場合は、行ごとに別の吹き出しにする（話者名があれば残す）
- セリフが空のコマは、吹き出しを省略してよい
- 起承転結の流れを意識した構成

${charactersSection ? `【登場人物】\n${charactersSection}\n\n` : ''}

【各コマの内容】
${panelDescriptions}`;
}
