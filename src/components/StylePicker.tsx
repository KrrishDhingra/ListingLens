"use client";

import type { VideoStyle } from "@/lib/minimax";

interface StyleOption {
  id: VideoStyle;
  label: string;
  description: string;
  icon: string;
  tip?: string;
}

const OPTIONS: StyleOption[] = [
  {
    id: "walkthrough",
    label: "Property Walkthrough",
    description: "Smooth cinematic push-in through each room",
    icon: "🎬",
  },
  {
    id: "remove_furniture",
    label: "Remove Furniture",
    description: "Virtually empty the room — great for unfurnished listings",
    icon: "🛋️",
    tip: "Best for cluttered rooms",
  },
  {
    id: "drone",
    label: "Drone / Aerial Shot",
    description: "Rising aerial reveal from exterior photos",
    icon: "🚁",
    tip: "Use exterior or rooftop photos",
  },
  {
    id: "day_to_night",
    label: "Day to Night",
    description: "Transform daylight shots into golden hour twilight",
    icon: "🌅",
  },
  {
    id: "virtual_staging",
    label: "Virtual Staging",
    description: "AI adds stylish furniture to empty rooms",
    icon: "🛏️",
    tip: "Best for empty rooms",
  },
];

interface Props {
  value: VideoStyle;
  onChange: (v: VideoStyle) => void;
}

export default function StylePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
              selected
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold text-sm ${selected ? "text-brand-700" : "text-slate-800"}`}>
                    {opt.label}
                  </p>
                  {selected && (
                    <span className="ml-auto text-brand-500 text-xs font-bold">✓</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.description}</p>
                {opt.tip && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">💡 {opt.tip}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
