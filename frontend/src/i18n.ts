export type Language = 'ja' | 'en';

export const MESSAGES: Record<Language, Record<string, string>> = {
    ja: {
        'nav.blog': 'ブログ4コマ',
        'nav.movie': '動画4コマ',
        'nav.pricing': '料金プラン',
        'nav.howto': '使い方',
        'nav.language': '言語',
        'nav.language.ja': '日本語',
        'nav.language.en': 'English',

        'auth.login': 'ログイン',
        'auth.logout': 'ログアウト',
        'auth.managePlan': 'プラン管理',

        'blog.hero.title': 'ブログ4コマメーカー',
        'blog.hero.subtitle': '記事URLを貼るだけで、ブログ記事を4コマ漫画に自動変換',
        'blog.hero.note': '※現在はNote,Qiita,Zennに対応しております',
        'blog.loading': '4コマ漫画を生成中...',

        'movie.hero.title': '動画4コマメーカー',
        'movie.hero.subtitle': 'YouTube動画URLを貼るだけで、動画内容を4コマ漫画に自動変換',
        'movie.hero.note': '※YouTubeの動画に対応しております',
        'movie.loading': '動画を解析して4コマ漫画を生成中...',

        'form.blog.title': '4コマ漫画を生成',
        'form.blog.subtitle': 'ブログ記事を面白い4コマ漫画に変換します',
        'form.movie.title': '動画から4コマ漫画を生成',
        'form.movie.subtitle': 'YouTube動画の内容を面白い4コマ漫画に変換します',
        'form.articleUrl': '記事URL',
        'form.youtubeUrl': 'YouTube URL',
        'form.userPrompt': '補足指示',
        'form.optional': '（任意）',
        'form.generating': '生成中...',
        'form.generate': '4コマを生成する',
        'form.modelSettings': 'モデル設定',

        'mode.demo.description': 'キー不要（回数制限あり・透かしあり）',
        'mode.lite.description': '月30回まで（透かしなし）',
        'mode.pro.description': '月100回まで（透かしなし・優先）',
        'mode.byok.description': 'あなたのAPIキーで実行（キーは保存しません）',

        'result.title': '生成結果',
        'result.regenerate': 'もう一度生成する',
        'result.processing': '処理中...',
        'result.alt': '4コマ漫画',
        'result.demoNotice': 'これはデモ出力です。透かしなしの画像は、BYOKモードでAPIキーを入力してご利用ください。',
        'result.showStoryboard': '絵コンテ情報を表示',
        'result.panel': 'コマ',

        'error.title': 'エラーが発生しました',
        'error.retry': 'もう一度試す',

        'demo.exceeded.default': '本日のデモ回数に達しました。',
        'demo.switchToByok': 'BYOKで続ける →',
        'demo.remaining': '本日のデモ残り：',
        'demo.remaining.suffix': '回',

        'apiKey.title': 'Gemini APIキーを入力',
        'apiKey.close': '閉じる',
        'apiKey.notice': 'APIキーは保存しません（リクエスト時にのみ使用します）',
        'apiKey.start': '生成を開始',
        'apiKey.howto': 'APIキーの取得方法 →',

        'modelSettings.title': 'モデル設定',
        'modelSettings.storyboard': '絵コンテ生成モデル',
        'modelSettings.image': '画像生成モデル',
        'modelSettings.reset': 'デフォルトに戻す',
        'modelSettings.done': '完了',
    },
    en: {
        'nav.blog': 'Blog 4-Koma',
        'nav.movie': 'Video 4-Koma',
        'nav.pricing': 'Pricing',
        'nav.howto': 'How to',
        'nav.language': 'Language',
        'nav.language.ja': '日本語',
        'nav.language.en': 'English',

        'auth.login': 'Log in',
        'auth.logout': 'Log out',
        'auth.managePlan': 'Manage plan',

        'blog.hero.title': 'Blog 4-Koma Maker',
        'blog.hero.subtitle': 'Paste an article URL to turn it into a 4-panel comic',
        'blog.hero.note': 'Currently supported: Note, Qiita, Zenn',
        'blog.loading': 'Generating your 4-panel comic...',

        'movie.hero.title': 'Video 4-Koma Maker',
        'movie.hero.subtitle': 'Paste a YouTube URL to turn it into a 4-panel comic',
        'movie.hero.note': 'Supported: YouTube videos',
        'movie.loading': 'Analyzing the video and generating a 4-panel comic...',

        'form.blog.title': 'Generate a 4-panel comic',
        'form.blog.subtitle': 'Turn a blog post into a fun 4-panel comic',
        'form.movie.title': 'Generate from a video',
        'form.movie.subtitle': 'Turn a YouTube video into a fun 4-panel comic',
        'form.articleUrl': 'Article URL',
        'form.youtubeUrl': 'YouTube URL',
        'form.userPrompt': 'Additional instructions',
        'form.optional': '(optional)',
        'form.generating': 'Generating...',
        'form.generate': 'Generate 4-panel comic',
        'form.modelSettings': 'Model settings',

        'mode.demo.description': 'No key needed (limited, watermarked)',
        'mode.lite.description': 'Up to 30/month (no watermark)',
        'mode.pro.description': 'Up to 100/month (no watermark, priority)',
        'mode.byok.description': 'Use your own API key (not stored)',

        'result.title': 'Result',
        'result.regenerate': 'Generate again',
        'result.processing': 'Processing...',
        'result.alt': '4-panel comic',
        'result.demoNotice': 'This is a demo output. For a watermark-free image, use BYOK mode and provide your API key.',
        'result.showStoryboard': 'Show storyboard details',
        'result.panel': 'Panel',

        'error.title': 'Something went wrong',
        'error.retry': 'Try again',

        'demo.exceeded.default': "You've reached today's demo limit.",
        'demo.switchToByok': 'Continue with BYOK →',
        'demo.remaining': 'Demo remaining today: ',
        'demo.remaining.suffix': ' times',

        'apiKey.title': 'Enter your Gemini API key',
        'apiKey.close': 'Close',
        'apiKey.notice': 'We do not store your API key (used only for the request).',
        'apiKey.start': 'Start generating',
        'apiKey.howto': 'How to get an API key →',

        'modelSettings.title': 'Model settings',
        'modelSettings.storyboard': 'Storyboard model',
        'modelSettings.image': 'Image model',
        'modelSettings.reset': 'Reset to defaults',
        'modelSettings.done': 'Done',
    },
};

export function t(language: Language, key: string): string {
    return MESSAGES[language]?.[key] ?? MESSAGES.ja[key] ?? key;
}

export function getMissingKeys(language: Language): string[] {
    const otherLanguage: Language = language === 'ja' ? 'en' : 'ja';
    const baseKeys = Object.keys(MESSAGES[otherLanguage]);
    const targetKeys = new Set(Object.keys(MESSAGES[language]));
    return baseKeys.filter((k) => !targetKeys.has(k)).sort();
}
