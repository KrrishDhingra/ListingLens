const MINIMAX_BASE = "https://api.minimax.io";

export type VideoStyle =
  | "walkthrough"
  | "remove_furniture"
  | "drone"
  | "day_to_night"
  | "virtual_staging";

const STYLE_PROMPTS: Record<VideoStyle, string> = {
  walkthrough:
    "[Push in] Smooth cinematic property walkthrough, professional real estate video, warm lighting, steady camera movement through the space.",
  remove_furniture:
    "[Push in] Empty room walkthrough, virtually staged to be completely unfurnished, clean walls and floors, bright and airy, professional real estate photography style.",
  drone:
    "[Pedestal up] Cinematic aerial drone shot rising above the property exterior, sweeping upward reveal, golden hour lighting, wide angle establishing shot.",
  day_to_night:
    "[Static shot] Time-lapse transformation from bright daytime to beautiful twilight golden hour, warm interior lights glow through windows, dramatic sky transition.",
  virtual_staging:
    "[Push in] Beautifully furnished and decorated interior, modern Scandinavian furniture, tasteful decor, warm lighting, luxury real estate staging.",
};

export function buildPrompt(style: VideoStyle, userNotes?: string): string {
  const base = STYLE_PROMPTS[style];
  return userNotes ? `${base} ${userNotes}` : base;
}

export async function createVideoTask(
  imageUrl: string,
  style: VideoStyle,
  userNotes?: string,
  resolution: "768P" | "1080P" = "1080P",
  duration: 6 | 10 = 6
): Promise<string> {
  const prompt = buildPrompt(style, userNotes);

  const res = await fetch(`${MINIMAX_BASE}/v1/video_generation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: "MiniMax-Hailuo-2.3",
      first_frame_image: imageUrl,
      prompt,
      resolution,
      duration,
      prompt_optimizer: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax error: ${data.base_resp?.status_msg}`);
  }

  return data.task_id as string;
}

export async function queryVideoTask(taskId: string): Promise<{
  status: "Queueing" | "Processing" | "Success" | "Fail";
  fileId?: string;
}> {
  const res = await fetch(
    `${MINIMAX_BASE}/v1/query/video_generation?task_id=${taskId}`,
    {
      headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY}` },
    }
  );

  if (!res.ok) throw new Error(`MiniMax query error ${res.status}`);
  const data = await res.json();

  return {
    status: data.status,
    fileId: data.file_id,
  };
}

/**
 * Download a finished video's bytes using MiniMax's documented two-step flow:
 *   1. GET /v1/files/retrieve  -> JSON containing file.download_url
 *   2. fetch that download_url -> the actual MP4 bytes
 * Returns the raw video buffer + content type. Throws with a descriptive
 * message on any failure so the caller can mark the job failed cleanly.
 */
export async function downloadVideo(
  fileId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  // Step 1: resolve the temporary download URL. GroupId is included when
  // configured (required on some MiniMax accounts).
  const groupId = process.env.MINIMAX_GROUP_ID;
  const retrieveUrl =
    `${MINIMAX_BASE}/v1/files/retrieve?file_id=${fileId}` +
    (groupId ? `&GroupId=${groupId}` : "");

  const metaRes = await fetch(retrieveUrl, {
    headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY}` },
  });

  const metaText = await metaRes.text();
  if (!metaRes.ok) {
    throw new Error(`files/retrieve failed ${metaRes.status}: ${metaText}`);
  }

  let meta: any;
  try {
    meta = JSON.parse(metaText);
  } catch {
    throw new Error(`files/retrieve returned non-JSON: ${metaText.slice(0, 300)}`);
  }

  if (meta.base_resp && meta.base_resp.status_code !== 0) {
    throw new Error(`files/retrieve error: ${meta.base_resp.status_msg}`);
  }

  const downloadUrl: string | undefined =
    meta.file?.download_url || meta.file?.backup_download_url;
  if (!downloadUrl) {
    throw new Error(
      `No download_url in files/retrieve response: ${metaText.slice(0, 300)}`
    );
  }

  // Step 2: fetch the actual video bytes from the resolved URL.
  const videoRes = await fetch(downloadUrl);
  if (!videoRes.ok) {
    throw new Error(`Video download failed ${videoRes.status} from download_url`);
  }

  const contentType = videoRes.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  return { buffer, contentType };
}
