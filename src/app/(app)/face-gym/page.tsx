import { auth } from "@clerk/nextjs/server";
import { FaceGymCoachCard } from "@/components/app/face-gym-coach-card";
import { FaceGymSession } from "@/components/app/face-gym-session";
import { getDb } from "@/db";
import { getFaceGymStats } from "@/db/queries/face-gym";
import {
  FACE_GYM_EXERCISES,
  FACE_GYM_ROUND_SECONDS,
  FACE_GYM_TOTAL_SECONDS,
} from "@/lib/face-gym";

export const metadata = {
  title: "Face Gym",
  description:
    "Your face has 43 muscles. Work them — one minute per round, guided on video.",
};

export default async function FaceGymPage() {
  const { userId } = await auth();
  const stats = await getFaceGymStats(getDb(), userId!);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Face Gym</h1>
        {/* The whole pitch in three sentences, and it earns its space: nobody
            arrives at this screen already convinced that facial muscles are
            trainable. Once they've done a session it's just a header. */}
        <p className="max-w-prose text-muted-foreground">
          Your face has 43 muscles. You work your biceps.{" "}
          <span className="text-foreground">Why aren&apos;t you working these?</span>
        </p>
        <p className="font-mono text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
          {FACE_GYM_EXERCISES.length} rounds · {FACE_GYM_ROUND_SECONDS}s each ·{" "}
          {Math.round(FACE_GYM_TOTAL_SECONDS / 60)} min
        </p>
      </div>

      <FaceGymCoachCard stats={stats} />

      <FaceGymSession exercises={FACE_GYM_EXERCISES} />
    </div>
  );
}
