import { apiResponse } from './api.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDatabaseBackup() {
  const response = await apiResponse('/api/admin/database-backup');
  const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
    || 'knowingre-backup.db';
  downloadBlob(await response.blob(), filename);
}
