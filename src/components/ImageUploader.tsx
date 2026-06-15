"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";

interface Props {
  onImagesChange: (files: File[]) => void;
}

export default function ImageUploader({ onImagesChange }: Props) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newItems = accepted.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      const updated = [...previews, ...newItems].slice(0, 20);
      setPreviews(updated);
      onImagesChange(updated.map((p) => p.file));
    },
    [previews, onImagesChange]
  );

  const remove = (idx: number) => {
    URL.revokeObjectURL(previews[idx].url);
    const updated = previews.filter((_, i) => i !== idx);
    setPreviews(updated);
    onImagesChange(updated.map((p) => p.file));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: true,
    maxSize: 20 * 1024 * 1024,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl">📸</span>
          <div>
            <p className="font-semibold text-slate-700">
              {isDragActive ? "Drop photos here" : "Drag & drop property photos"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              or <span className="text-brand-600 font-medium">click to browse</span> · JPG, PNG, WebP · max 20MB each · up to 20 photos
            </p>
          </div>
        </div>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {previews.map((p, i) => (
            <div key={p.url} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
              <Image src={p.url} alt={`Photo ${i + 1}`} fill className="object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  Cover
                </span>
              )}
              <button
                onClick={() => remove(i)}
                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
          <div
            {...getRootProps()}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 flex items-center justify-center cursor-pointer text-slate-400 hover:text-brand-500 transition-colors text-3xl"
          >
            <input {...getInputProps()} />
            +
          </div>
        </div>
      )}
    </div>
  );
}
