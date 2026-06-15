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
  downloadUrl?: string;
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
    downloadUrl: data.file_id
      ? `${MINIMAX_BASE}/v1/files/retrieve?GroupId=${process.env.MINIMAX_GROUP_ID}&file_id=${data.file_id}`
      : undefined,
  };
}
