⛬  セキュリティ観点のリスク洗い出し（修正提案のみ・コード変更なし）

   1) 現状アーキテクチャ（信頼境界）
   •  フロントエンド: Vite/React（frontend/）→ /api/* を叩く
   •  バックエンド: Cloudflare Pages Functions（functions/api/*.ts）
   •  秘密情報の扱い
     •  Demo: サーバ側環境変数 DEMO_GEMINI_API_KEY を使用
     •  BYOK: ユーザ入力の geminiApiKey を リクエストボディでサーバへ送信し、サーバがGeminiへ中継
   •  永続化: KV URL_LOGS（入力URLを保存）、KV DEMO_LIMITS（IPベースの回数制限）

   ──────────────────────────────────────────

   2) 優先度高（High）リスク

   H-1: CORSが `*` で、Demoキー利用APIが第三者サイトから濫用可能（コスト/悪用）

   根拠: functions/api/* のCORSが Access-Control-Allow-Origin: '*'
   例: functions/api/generate-4koma.ts, generate-movie-4koma.ts, demo-status.ts, movie-demo-status.ts

   影響
   •  攻撃者が任意のWebサイトからあなたの /api/generate-* を叩ける（ブラウザからでも可能）
   •  Demoキー（サーバ秘密）を使った生成が 第三者により消費され、課金・リソース枯渇・サービス劣化につながる
   ※IP日次制限はあるが、分散IP・ボットで迂回されやすい

   推奨（設計）
   •  Access-Control-Allow-Origin を 本番ドメインに限定（Vary: Origin も併用）
   •  Demoモードは Turnstile 等の人間判定、もしくは署名付きトークン等の軽い認可を挟む
   •  Cloudflareの WAF / Rate Limiting / Bot Management を併用（アプリ側IP制限だけに依存しない）

   ──────────────────────────────────────────

   H-2: Gemini APIキーをクエリ文字列 `?key=...` で送信（ログ/監視/可観測性経由の漏えいリスク）

   根拠:
   •  functions/api/generate-4koma.ts などで ...generateContent?key=${apiKey}

   影響
   •  URL（クエリ付き）がログ・メトリクス・トレース・障害調査の出力に混入すると、APIキーが漏れる可能性
   （アプリが意図的にログ出力していなくても、周辺の観測基盤設定次第で起きうる）

   推奨（設計）
   •  x-goog-api-key 等の ヘッダ送信に切替（「URLに秘密を載せない」）
   •  例外/エラーハンドリングで、外部リクエスト先URLをログしない運用を徹底

   ──────────────────────────────────────────

   H-3: URL_LOGS にユーザ入力URLを無期限保存（プライバシー/トークン混入のリスク）

   根拠:
   •  functions/api/generate-4koma.ts / generate-movie-4koma.ts の logUrlToKV() が kv.put() するが TTL無し

   影響
   •  ユーザが「共有リンク」「クエリにトークンを含むURL」等を貼った場合、そのまま永続化され得る
   •  入力URLは個人情報・行動履歴になり得る（規約/同意/保管期間の論点）

   推奨（設計）
   •  保存するなら最小化（例: origin + pathname のみ、search/hash は破棄）
   •  短いTTL（例: 7日/30日）を設定、収集目的を明確化し同意導線を用意
   •  必要に応じて暗号化/ハッシュ化、アクセス制御・運用者閲覧範囲の制限

   ──────────────────────────────────────────

   3) 中優先度（Medium）リスク

   M-1: デモ回数制限が「生IP」をKVキーに含める（個人情報・運用リスク）

   根拠:
   •  DEMO_LIMITS のキーが demo:${clientIP}:${today} / movie-demo:${clientIP}:${today}

   影響
   •  IPアドレスは個人情報扱いになりやすい（法務/プライバシー観点）
   •  監査・ログ開示の範囲が広がる

   推奨
   •  clientIP は ソルト付きハッシュにして保存（TTLは既に24hで良い設計）
   •  可能ならCloudflare側のレート制限機能へ寄せ、アプリ側PII保持を減らす

   ──────────────────────────────────────────

   M-2: セキュリティヘッダ（CSP等）が明示されていない（XSS耐性の底上げ余地）

   根拠: frontend/public に _headers が無い（_redirectsのみ）
   現状: Reactで dangerouslySetInnerHTML 等は見当たらず良いが、将来の変更や依存追加に備えたい

   推奨
   •  Cloudflare Pages の _headers で最低限:
     •  Content-Security-Policy（段階導入）
     •  X-Content-Type-Options: nosniff
     •  Referrer-Policy
     •  Permissions-Policy
     •  frame-ancestors 'none' 相当（CSP側で）

   ──────────────────────────────────────────

   M-3: 入力サイズ/取得HTMLサイズの上限が実質弱い（DoS/コスト増）

   根拠
   •  request.json() をそのまま受け、userPrompt 等の長さ制限がない
   •  記事HTMLは 全量ダウンロード → 抽出後に 8000文字へトリム（fetchArticle）

   影響
   •  許可ドメイン上の巨大ページや長文プロンプトで、CPU/メモリ/帯域消費増、タイムアウト増

   推奨
   •  articleUrl/youtubeUrl/userPrompt の 最大長をサーバ側で制限
   •  可能ならレスポンスサイズ上限（ストリームで一定バイトで打ち切り等）を検討

   ──────────────────────────────────────────

   4) 低〜中（Low/Medium）リスク・注意点

   L-1: BYOKは「あなたのサーバがAPIキーを中継する」方式（秘密情報処理者になる）

   現状
   •  フロントはキーを保存していない（ApiKeyModal → リクエスト時のみ）点は良い
   •  ただしサーバ経由のため、運用/監視設定によってはリクエストボディが観測対象になり得る

   推奨
   •  監視/ログ/エラーレポートで リクエストボディを収集しない運用を明文化
   •  さらに強くするなら「クライアントから直接Geminiへ」方式（ただしCORS/秘匿/設計が別途必要）

   L-2: 外部依存（noembed.com）

   根拠: functions/api/generate-movie-4koma.ts が noembed.com を利用
   影響: 可用性・プライバシー（アクセス先が増える）
   推奨: 障害時のフォールバック/リトライ方針、プライバシーポリシーへの明記

   ──────────────────────────────────────────

   5) 簡易チェック結果（良い点）
   •  フロント側で危険なHTML挿入（dangerouslySetInnerHTML 等）は見当たりませんでした
   •  .env / .dev.vars は .gitignore 対象で、リポジトリに追跡されにくい構成です
   •  npm audit --omit=dev は 0 vulnerabilities（依存由来の既知脆弱性は現時点で未検出）

   ──────────────────────────────────────────

   必要なら、この一覧を「脅威モデル（攻撃者・資産・侵入口・緩和策）」形式に整理して、優先度順の対策ロードマッ
   プ（工数感付き）まで落とし込みます。

>  この内容をMD形式でレポートとして出力して

⛬  blog24koma セキュリティリスク分析レポート（修正作業なし）

   •  対象: /mnt/c/docker/blog24koma
   •  目的: 現状実装・設定から想定されるセキュリティ/プライバシーリスクの洗い出し（提案のみ）
   •  実施日: 2025-12-15

   ──────────────────────────────────────────

   1. サマリー（重要度順）

   High（優先対応）
   1. *CORS が `` のため、第三者サイトから Demo キー利用 API を濫用されうる（コスト/悪用）**
   2. Gemini API キーをクエリ `?key=` で送信しており、ログ/観測系経由で漏えいしやすい
   3. URL_LOGS にユーザ入力URLを TTL なしで保存しており、プライバシー/トークン混入リスク

   Medium（計画的対応）
   4. デモ回数制限が生IPをキーに含む（PII・運用負担）
   5. CSP 等のセキュリティヘッダが明示されていない（将来のXSS耐性の底上げ余地）
   6. 入力サイズ/取得HTMLサイズの上限が弱く、DoS/コスト増の余地

   Low（注意）
   7. BYOK はサーバ中継のため、運用/ログ設定次第でキーや本文が収集対象になり得る
   8. 外部依存（noembed.com）に可用性・プライバシー上の依存がある

   ──────────────────────────────────────────

   2. 対象システム概要（信頼境界）

   2.1 構成要素
   •  フロントエンド: Vite/React（frontend/）
     •  /api/* を fetch してバックエンドへ
   •  バックエンド: Cloudflare Pages Functions（functions/api/*.ts）
   •  KV
     •  URL_LOGS: 入力URLログ
     •  DEMO_LIMITS: デモ回数制限（IP+日付）

   2.2 秘密情報の扱い
   •  Demo: サーバ環境変数 DEMO_GEMINI_API_KEY を使用
   •  BYOK: ユーザが入力した geminiApiKey を リクエストボディでサーバへ送信し、サーバが Gemini へ中継

   ──────────────────────────────────────────

   3. 詳細リスク（証跡・影響・推奨）

   H-1: CORS `Access-Control-Allow-Origin: '*'` による第三者サイトからの濫用（コスト/悪用）

   証跡（例）
   •  functions/api/generate-4koma.ts: CORSヘッダ
   •  functions/api/generate-movie-4koma.ts: CORSヘッダ
   •  functions/api/demo-status.ts, functions/api/movie-demo-status.ts: CORSヘッダ
   いずれも Access-Control-Allow-Origin: '*'

   想定される攻撃/影響
   •  攻撃者のWebサイトが、ユーザのブラウザからあなたの /api/generate-* にクロスオリジンで POST できる
   •  Demo モードではサーバ側の DEMO_GEMINI_API_KEY が消費され、第三者にコストを肩代わりさせられる
   •  DEMO_LIMITS の IP 日次制限はあるが、分散IP/ボットで迂回されやすい

   推奨（設計/運用）
   •  Access-Control-Allow-Origin を 本番ドメインに限定（必要なら Origin 動的、Vary: Origin 付与）
   •  Demo 生成は Cloudflare Turnstile 等の人間判定、または署名付きトークン等の軽量認可を導入
   •  Cloudflare 側の WAF / Rate Limiting / Bot 管理で多層防御（アプリIP制限のみ依存を避ける）

   ──────────────────────────────────────────

   H-2: Gemini API キーを `?key=` クエリに載せて送信（漏えいリスク）

   証跡
   •  functions/api/generate-4koma.ts:
     .../models/${model}:generateContent?key=${apiKey}
   •  functions/api/generate-movie-4koma.ts: 同様

   影響
   •  URL（クエリ付き）がログ、例外、トレース、観測、プロキシの診断などに残ると、APIキーが漏れる可能性が上が
      る

   推奨
   •  可能なら ヘッダ経由（例: x-goog-api-key）に切替し、「秘密をURLに載せない」
   •  エラー時のログ出力で、外部リクエスト先URLを出さない/マスクする運用を徹底

   ──────────────────────────────────────────

   H-3: URL_LOGS への入力URL保存が TTL 無し（プライバシー/トークン混入）

   証跡
   •  functions/api/generate-4koma.ts / generate-movie-4koma.ts の logUrlToKV() が kv.put() するが
      TTL/期限が指定されていない

   影響
   •  ユーザがクエリにトークン等を含むURLを入力した場合、そのまま保存される可能性
   •  入力URLは行動履歴/個人情報になり得るため、保管期間・閲覧権限・目的の説明が必要

   推奨
   •  保存最小化（例: origin + pathname のみ、search/hash は破棄）
   •  短い TTL（例: 7日/30日）を設定
   •  収集目的の明確化、アクセス制御、必要ならハッシュ化/暗号化

   ──────────────────────────────────────────

   M-1: DEMO_LIMITS のキーに生IPを含める（PII/運用リスク）

   証跡
   •  functions/api/generate-4koma.ts: demo:${clientIP}:${today}
   •  functions/api/generate-movie-4koma.ts: movie-demo:${clientIP}:${today}
   •  functions/api/demo-status.ts, functions/api/movie-demo-status.ts: 同様のキー算出

   影響
   •  IPアドレスは個人情報扱いになり得るため、取り扱い・監査・開示対応の負荷が増える

   推奨
   •  clientIP は ソルト付きハッシュにしてキー化（TTLは現状24hで妥当）
   •  可能なら Cloudflare のレート制限機能へ寄せ、アプリ側のPII保持を減らす

   ──────────────────────────────────────────

   M-2: CSP等のセキュリティヘッダ未整備（将来のXSS耐性）

   証跡
   •  frontend/public/_redirects は存在するが、_headers が見当たらない
   •  frontend/index.html に CSP 等の meta 指定なし

   現状の良い点
   •  フロントで dangerouslySetInnerHTML 等の危険なHTML挿入は見当たらない（探索範囲内）

   推奨
   •  Cloudflare Pages の _headers で最低限:
     •  Content-Security-Policy（段階導入推奨）
     •  X-Content-Type-Options: nosniff
     •  Referrer-Policy
     •  Permissions-Policy
     •  frame-ancestors（CSP側で）等

   ──────────────────────────────────────────

   M-3: 入力/取得コンテンツのサイズ制限が弱い（DoS/コスト増）

   証跡
   •  functions/api/generate-4koma.ts: request.json() を受け、userPrompt 等の長さ制限が明示的にない
   •  記事HTMLは全量取得後に本文を抽出し、抽出後に 8000 文字へトリム（parseArticleHtml）

   影響
   •  長大入力や巨大ページにより CPU/メモリ/帯域消費が増え、タイムアウトやコスト増につながる

   推奨
   •  userPrompt や URL 文字列の最大長をサーバ側で制限
   •  取得HTMLの上限（一定バイトで打ち切り等）を検討

   ──────────────────────────────────────────

   L-1: BYOK はサーバ中継であり、ログ/監視設定次第で漏えい面がある

   証跡
   •  フロント: frontend/src/components/InputForm.tsx, MovieInputForm.tsx が geminiApiKey を含めて送信
   •  API: functions/api/generate-4koma.ts, generate-movie-4koma.ts が body.geminiApiKey を使用

   現状の良い点
   •  ApiKeyModal は保存していない（UI説明も「保存しません」）

   推奨
   •  監視/ログ/エラーレポートで リクエストボディを収集しない運用を明文化
   •  将来的に「クライアントから直接Gemini」方式へ変更する場合は別途脅威モデルが必要

   ──────────────────────────────────────────

   L-2: 外部依存（noembed.com）

   証跡
   •  functions/api/generate-movie-4koma.ts: https://noembed.com/embed?...

   影響
   •  可用性（外部障害）とプライバシー（アクセス先増）の依存が増える

   推奨
   •  障害時のフォールバック/リトライ方針
   •  プライバシー面の説明（必要に応じて）

   ──────────────────────────────────────────

   4. 依存関係・既知脆弱性の簡易確認
   •  npm audit --omit=dev: 0 vulnerabilities（実行時点）

   ──────────────────────────────────────────

   5. 追加メモ（現状の安全寄りの実装）
   •  フロント側で危険なHTML挿入は見当たりませんでした（探索範囲内）
   •  .env / .dev.vars は .gitignore 対象（リポジトリ追跡されにくい）

   ──────────────────────────────────────────

   6. 推奨される次アクション（優先順）
   1. CORSを本番Originに限定し、Demo API を悪用されにくくする（必要なら Turnstile/Rate Limit/WAF）
   2. Gemini APIキーをURLクエリからヘッダ送信へ移行
   3. URL_LOGS の保存内容最小化＋TTL導入
   4. DEMO_LIMITS のIPをハッシュ化
   5. CSP等のセキュリティヘッダ整備
   6. 入力長・取得サイズ等のリソース制限

   ──────────────────────────────────────────
