import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { getAnalysisForScan } from "@/db/queries/skin-analysis";
import { getSimulationForScan } from "@/db/queries/skin-simulations";

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

  // The goal image is generated after the analysis lands, so it's still in
  // flight when the analysis first reports "succeeded". Reported on the same
  // poll the page is already running rather than adding a second one — the
  // client keeps polling until this settles too.
  const simulation = await getSimulationForScan(db, userId, scanId);

  return Response.json({
    status: analysis.status,
    skinAge: analysis.skinAge,
    errorMessage: analysis.errorMessage,
    // `null` means no row yet, which for a succeeded analysis means the
    // simulation job hasn't started writing — treated as in-flight by the
    // client, not as absent.
    simulationStatus: simulation?.status ?? null,
  });
}
