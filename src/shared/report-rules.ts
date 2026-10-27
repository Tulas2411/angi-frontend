export const maxReportEvidence = 5;
export const maxReportLength = 1000;

/** The reason “other” needs a description; every description stays within the limit. */
export function reportProblems(reason: string, description: string) {
  const problems: { description?: string } = {};
  const text = description.trim();
  if (reason === "other" && !text)
    problems.description = "Hãy mô tả lý do khi chọn “Lý do khác”.";
  else if (text.length > maxReportLength)
    problems.description = `Mô tả tối đa ${maxReportLength} ký tự.`;
  return problems;
}
