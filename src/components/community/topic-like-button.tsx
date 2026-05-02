"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleTopicLikeAction } from "@/app/(student)/community/actions";

export function TopicLikeButton({
  topicId,
  initialLiked,
  initialCount,
}: {
  topicId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function handleLike() {
    setLiked((p) => !p);
    setCount((c) => (liked ? Math.max(c - 1, 0) : c + 1));
    startTransition(async () => {
      const res = await toggleTopicLikeAction(topicId);
      if (!res.ok) {
        setLiked((p) => !p);
        setCount((c) => (liked ? c + 1 : Math.max(c - 1, 0)));
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 transition ${
        liked ? "text-red-400" : "text-npb-text-muted hover:text-red-400"
      }`}
    >
      <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
      <span className="font-semibold">{count}</span>
    </button>
  );
}
