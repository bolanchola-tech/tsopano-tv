export async function fetchPlaylistItems(playlistId) {
  const key = import.meta.env.VITE_YT_API_KEY;
  if (!key) throw new Error("API key missing");
  const items = [];
  let pageToken = "";
  const maxLoops = 6;
  let loops = 0;
  while (loops < maxLoops) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", key);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Playlist fetch failed");
    const json = await res.json();
    if (Array.isArray(json.items)) items.push(...json.items);
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
    loops++;
  }
  const ids = items.map(i => i.contentDetails?.videoId).filter(Boolean);
  const details = await fetchVideoDetails(ids, key);
  const durationMap = new Map(details.map(d => [d.id, d.contentDetails?.duration || "PT0S"]));
  const result = items.map((i, idx) => {
    const vid = i.contentDetails?.videoId;
    const sn = i.snippet || {};
    return {
      id: `yt-${vid}`,
      title: sn.title || `YouTube ${vid}`,
      genre: "Web",
      duration: isoToClock(durationMap.get(vid) || "PT0S"),
      views: 0,
      watchTime: 0,
      completion: 0,
      thumb: bestThumb(sn.thumbnails),
      hls: "#",
      youtubeId: vid,
      description: sn.description || "Imported from YouTube",
      producer: sn.channelTitle || "YouTube",
      episode: `Item ${idx + 1}`,
      year: new Date(sn.publishedAt || Date.now()).getFullYear(),
    };
  });
  return result;
}

export async function fetchPlaylistMeta(playlistId) {
  const key = import.meta.env.VITE_YT_API_KEY;
  if (!key) throw new Error("API key missing");
  const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", playlistId);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Playlist meta fetch failed");
  const json = await res.json();
  const p = json.items?.[0];
  if (!p) throw new Error("Playlist not found");
  const count = p.contentDetails?.itemCount || 0;
  const sn = p.snippet || {};
  return {
    title: sn.title || "YouTube Playlist",
    description: sn.description || "",
    thumb: bestThumb(sn.thumbnails),
    count,
  };
}

async function fetchVideoDetails(ids, key) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    if (slice.length === 0) continue;
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", slice.join(","));
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) continue;
    const json = await res.json();
    if (Array.isArray(json.items)) out.push(...json.items);
  }
  return out;
}

function bestThumb(t) {
  return t?.maxres?.url || t?.standard?.url || t?.high?.url || t?.medium?.url || t?.default?.url || "";
}

function isoToClock(iso) {
  try {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "--:--";
    const h = parseInt(m[1] || "0", 10);
    const mins = parseInt(m[2] || "0", 10);
    const secs = parseInt(m[3] || "0", 10);
    const total = h * 3600 + mins * 60 + secs;
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(total % 60).toString().padStart(2, "0");
    return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  } catch {
    return "--:--";
  }
}
