import type {
  RecognitionAnalysisRevision,
  RecognitionArchive,
  RecognitionModelRun,
  RecognitionModelRunAttempt,
  RecognitionModelRunPresentation,
} from "./recognition-schema.js";

type ObjectValue = Record<string, unknown>;

function asObject(value: unknown): ObjectValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null;
}

function finishReason(value: unknown): string | null {
  const root = asObject(value);
  const choices = root && Array.isArray(root.choices) ? root.choices : [];
  const firstChoice = choices.length ? asObject(choices[0]) : null;
  const reason = firstChoice?.finish_reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function httpStatus(message: string | undefined): number | null {
  if (!message) return null;
  const marker = "HTTP ";
  const start = message.indexOf(marker);
  if (start === -1) return null;
  const digits = message.slice(start + marker.length, start + marker.length + 3);
  const parsed = Number(digits);
  return Number.isInteger(parsed) ? parsed : null;
}

function mentionsConfirmation(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLocaleLowerCase();
  return lower.includes("confirmation") || lower.includes("age");
}

function responseCompleteness(attempt: RecognitionModelRunAttempt | undefined): RecognitionModelRunPresentation["responseCompleteness"] {
  if (!attempt) return "unavailable";
  if (attempt.rawAnswer === undefined) return attempt.status === "response_saved" ? "empty" : "unavailable";
  if (!attempt.rawAnswer.trim()) return "empty";
  if (finishReason(attempt.rawProviderResponse) === "length") return "incomplete";
  return "complete";
}

function localAnalysis(revision: RecognitionAnalysisRevision | undefined, archive: RecognitionArchive | undefined): RecognitionModelRunPresentation["localAnalysis"] {
  if (revision) return revision.status;
  if (!archive) return "not_started";
  if (archive.result.analysisStatus === "analysis_failed") return "failed";
  return archive.result.fieldIssues?.length ? "partial" : "complete";
}

function statusCopy(input: {
  modelRun: RecognitionModelRun;
  attempt: RecognitionModelRunAttempt | undefined;
  response: RecognitionModelRunPresentation["responseCompleteness"];
  local: RecognitionModelRunPresentation["localAnalysis"];
}): Pick<RecognitionModelRunPresentation, "statusLabel" | "detail" | "primaryAction"> {
  const status = httpStatus(input.modelRun.errorMessage || input.attempt?.errorMessage);
  if (status === 404) return {
    statusLabel: "当前模型与所选请求配置没有可用接口",
    detail: "本次请求没有找到可用端点。请检查模型与联网配置后再决定是否重新请求。",
    primaryAction: "check_model_configuration",
  };
  if (status === 403 && mentionsConfirmation(input.modelRun.errorMessage || input.attempt?.errorMessage)) return {
    statusLabel: "OpenRouter 账户需先完成使用条件确认",
    detail: "完成账户设置后，用户可以自行发起新的请求。",
    primaryAction: "open_provider_settings",
  };
  if (input.modelRun.status === "queued") return { statusLabel: "等待开始", detail: null, primaryAction: "none" };
  if (input.modelRun.status === "running") return { statusLabel: "正在调用模型", detail: null, primaryAction: "none" };
  if (input.response === "incomplete") return {
    statusLabel: "回答不完整：输出达到长度限制",
    detail: "已保存收到的原始内容；不会补全或将其用于认知结论。",
    primaryAction: "none",
  };
  if (input.response === "empty") return { statusLabel: "模型没有返回可用回答", detail: null, primaryAction: "retry_request" };
  if (input.response === "unavailable" && input.modelRun.status === "unsupported") return { statusLabel: "当前模型不支持此请求配置", detail: null, primaryAction: "check_model_configuration" };
  if (input.response === "unavailable" && input.modelRun.status === "failed") return { statusLabel: "Provider 调用失败", detail: null, primaryAction: "retry_request" };
  if (input.local === "failed") return {
    statusLabel: "回答已收到，本地整理失败",
    detail: "可以只根据已保存的原始回答重新整理；不会再次调用模型。",
    primaryAction: "reanalyze_saved_answer",
  };
  if (input.local === "partial") return {
    statusLabel: "回答已收到，部分信息可用",
    detail: "缺失或格式不正确的字段会明确保留为空，不会推断。",
    primaryAction: "none",
  };
  if (input.local === "complete") return { statusLabel: "回答已收到，整理完成", detail: null, primaryAction: "none" };
  return { statusLabel: "回答状态尚无法确认", detail: null, primaryAction: "none" };
}

export function buildRecognitionModelRunPresentation(input: {
  modelRun: RecognitionModelRun;
  attempts: RecognitionModelRunAttempt[];
  archive?: RecognitionArchive | undefined;
  currentAnalysis?: RecognitionAnalysisRevision | undefined;
}): RecognitionModelRunPresentation {
  const attempt = input.attempts.length ? input.attempts[input.attempts.length - 1] : undefined;
  const response = responseCompleteness(attempt);
  const local = localAnalysis(input.currentAnalysis, input.archive);
  const copy = statusCopy({ modelRun: input.modelRun, attempt, response, local });
  const activeArchive = input.currentAnalysis?.archive || input.archive;
  return {
    requestExecution: input.modelRun.status === "queued" ? "not_started"
      : input.modelRun.status === "running" ? "running"
        : attempt?.rawAnswer !== undefined ? "response_received"
          : httpStatus(input.modelRun.errorMessage || attempt?.errorMessage) ? "request_rejected"
            : "transport_failed",
    responseCompleteness: response,
    localAnalysis: local,
    domainRecognition: activeArchive?.result.domainRecognition || null,
    primaryAction: copy.primaryAction,
    statusLabel: copy.statusLabel,
    detail: copy.detail,
  };
}
