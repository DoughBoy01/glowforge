import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { getAnalysisForScan } from "@/db/queries/skin-analysis";

/** Lightweight status poll for the client — never calls YouCam directly (the
 * API key stays server-side; the vendor poll loop runs once, in the
 * background job kicked off by the check-in action). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { scanId } = await params;
  const db = getDb();
  const analysis = await getAnalysisForScan(db, userId, scanId);

  if (!analysis) {
    return Response.json({ status: "not_found" }, { status: 404 });
  }

  return Response.json({
    status: analysis.status,
    skinAge: analysis.skinAge,
    errorMessage: analysis.errorMessage,
  });
}
