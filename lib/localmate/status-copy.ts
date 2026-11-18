export const taskStatusCopy = {
  review: "待复核",
  confirmation: "待确认",
  needsInformation: "待补充",
  notStarted: "未开始",
  completed: "已完成",
  professionalReview: "需专业复核",
} as const;

export function taskResultText(text: string, professional = false) {
  const review = professional ? taskStatusCopy.professionalReview : taskStatusCopy.review;
  return text.replace(/待人工核验|待人工复核/g, review).replaceAll("待业务确认", taskStatusCopy.confirmation);
}
