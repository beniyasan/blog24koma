export interface TranscriptLine {
    startSec: number;
    endSec: number;
    text: string;
}

interface TimedTextJson3 {
    events?: Array<{
        tStartMs?: number;
        dDurationMs?: number;
        segs?: Array<{ utf8?: string }>;
    }>;
}

function buildCandidateLangs(language?: string): string[] {
    const normalized = typeof language === 'string' ? language.trim().toLowerCase() : '';
    if (normalized === 'en') return ['en', 'ja'];
    if (normalized === 'ja') return ['ja', 'en'];
    return ['ja', 'en'];
}

function parseTimedTextJson3(data: unknown): TranscriptLine[] {
    if (!data || typeof data !== 'object') return [];
    const json = data as TimedTextJson3;
    const events = Array.isArray(json.events) ? json.events : [];

    const lines: TranscriptLine[] = [];
    for (const event of events) {
        const startMs = typeof event.tStartMs === 'number' ? event.tStartMs : undefined;
        const durationMs = typeof event.dDurationMs === 'number' ? event.dDurationMs : undefined;
        const segs = Array.isArray(event.segs) ? event.segs : [];

        if (startMs === undefined || durationMs === undefined) continue;

        const text = segs
            .map((s) => (typeof s.utf8 === 'string' ? s.utf8 : ''))
            .join('')
            .replace(/\s+/g, ' ')
            .trim();

        if (!text) continue;

        lines.push({
            startSec: Math.max(0, startMs / 1000),
            endSec: Math.max(0, (startMs + durationMs) / 1000),
            text,
        });
    }

    lines.sort((a, b) => a.startSec - b.startSec);
    return lines;
}

function sampleEvenly<T>(items: T[], maxItems: number): T[] {
    if (items.length <= maxItems) return items;
    const step = items.length / maxItems;
    const sampled: T[] = [];
    for (let i = 0; i < maxItems; i += 1) {
        sampled.push(items[Math.floor(i * step)]);
    }
    return sampled;
}

export function formatTranscriptForPrompt(
    lines: TranscriptLine[],
    options: { maxChars?: number; maxLines?: number } = {}
): string {
    const maxChars = options.maxChars ?? 12000;
    const maxLines = options.maxLines ?? 120;

    const selected = sampleEvenly(lines, maxLines);
    let out = '';
    for (const line of selected) {
        const row = `[${line.startSec.toFixed(1)}-${line.endSec.toFixed(1)}] ${line.text}\n`;
        if ((out.length + row.length) > maxChars) break;
        out += row;
    }
    return out.trim();
}

export async function fetchYouTubeTranscriptJson3(
    videoId: string,
    options: { language?: string; timeoutMs?: number } = {}
): Promise<TranscriptLine[]> {
    const langs = buildCandidateLangs(options.language);
    const timeoutMs = options.timeoutMs ?? 10000;

    const candidates: string[] = [];
    for (const lang of langs) {
        candidates.push(`https://www.youtube.com/api/timedtext?fmt=json3&lang=${encodeURIComponent(lang)}&v=${encodeURIComponent(videoId)}`);
        candidates.push(`https://www.youtube.com/api/timedtext?fmt=json3&lang=${encodeURIComponent(lang)}&kind=asr&v=${encodeURIComponent(videoId)}`);
    }

    let lastStatus: number | null = null;

    for (const url of candidates) {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; 4KomaBot/1.0)',
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(timeoutMs),
        });

        lastStatus = res.status;
        if (!res.ok) continue;

        const data = await res.json();
        const parsed = parseTimedTextJson3(data);
        if (parsed.length > 0) return parsed;
    }

    throw new Error(`Failed to fetch transcript (last status: ${lastStatus ?? 'n/a'})`);
}
