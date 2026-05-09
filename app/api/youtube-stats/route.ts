import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ID_RE = /^[a-zA-Z0-9_-]{6,}$/;

/** Public read: like count for a video. Set YOUTUBE_DATA_API_KEY in env (YouTube Data API v3). */
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId')?.trim() ?? '';
  if (!videoId || !ID_RE.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId', likeCount: null, commentCount: null }, { status: 400 });
  }

  const key = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ likeCount: null, commentCount: null, reason: 'missing_key' as const }, { status: 200 });
  }

  try {
    const u = new URL('https://www.googleapis.com/youtube/v3/videos');
    u.searchParams.set('part', 'statistics');
    u.searchParams.set('id', videoId);
    u.searchParams.set('key', key);
    const res = await fetch(u.toString(), { cache: 'no-store' });
    const data = (await res.json()) as {
      error?: { message?: string };
      items?: { statistics?: { likeCount?: string; commentCount?: string; viewCount?: string } }[];
    };
    if (!res.ok) {
      return NextResponse.json(
        {
          likeCount: null,
          commentCount: null,
          error: data?.error?.message ?? 'YouTube API error',
        },
        { status: 502 },
      );
    }
    const rawLikes = data.items?.[0]?.statistics?.likeCount;
    const rawComments = data.items?.[0]?.statistics?.commentCount;
    const likes = rawLikes != null ? Number.parseInt(String(rawLikes), 10) : NaN;
    const comments = rawComments != null ? Number.parseInt(String(rawComments), 10) : NaN;
    return NextResponse.json({
      likeCount: Number.isFinite(likes) ? likes : null,
      commentCount: Number.isFinite(comments) ? comments : null,
    });
  } catch {
    return NextResponse.json({ likeCount: null, commentCount: null, error: 'fetch_failed' }, { status: 502 });
  }
}
