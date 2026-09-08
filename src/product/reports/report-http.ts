import { ProductProjectNotFoundError } from "../projects/project-errors.js";
import { RecognitionReportEvidenceIntegrityError, RecognitionReportInputError, RecognitionReportNotFoundError, RecognitionReportSnapshotChangedError } from "./report-errors.js";
import { RecognitionReportService } from "./report-service.js";

export type ReportJsonSender = (status: number, body: unknown) => void;

function sendError(send: ReportJsonSender, error: unknown): void {
  if (error instanceof ProductProjectNotFoundError) return send(404, { error: error.message, code: "project_not_found" });
  if (error instanceof RecognitionReportNotFoundError) return send(404, { error: error.message, code: "recognition_report_not_found" });
  if (error instanceof RecognitionReportInputError) return send(409, { error: error.message, code: "recognition_report_not_ready" });
  if (error instanceof RecognitionReportSnapshotChangedError) return send(409, { error: error.message, code: "recognition_report_snapshot_changed" });
  if (error instanceof RecognitionReportEvidenceIntegrityError) return send(422, { error: error.message, code: "recognition_report_evidence_integrity" });
  return send(500, { error: error instanceof Error ? error.message : String(error), code: "recognition_report_operation_failed" });
}

export async function handleRecognitionReportApi(input: {
  method: string;
  route: string[];
  service: RecognitionReportService;
  send: ReportJsonSender;
}): Promise<boolean> {
  const { method, route, service, send } = input;
  try {
    if (route.length < 6 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "recognition-runs") return false;
    const projectId = route[2];
    const runId = route[4];
    if (!projectId || !runId || route[5] !== "reports") return false;
    if (route.length === 6 && method === "POST") return send(201, { report: await service.create(projectId, runId) }), true;
    if (route.length === 6 && method === "GET") return send(200, { reports: await service.list(projectId, runId) }), true;
    const reportId = route[6];
    if (!reportId) return false;
    if (route.length === 7 && method === "GET") return send(200, { report: await service.get(projectId, runId, reportId) }), true;
    const modelRunId = route[8];
    if (route.length === 9 && method === "GET" && route[7] === "model-runs" && modelRunId) {
      return send(200, { model: await service.getModel(projectId, runId, reportId, modelRunId) }), true;
    }
    return false;
  } catch (error) {
    sendError(send, error);
    return true;
  }
}
