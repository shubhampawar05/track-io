/** Keep in sync with Backend `upload.routes.ts` multer limits and `MAX_ISSUE_ATTACHMENTS` in issue.service.ts */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ISSUE_ATTACHMENTS = 20;

export function formatMaxUploadSize(): string {
  return "5 MB";
}
