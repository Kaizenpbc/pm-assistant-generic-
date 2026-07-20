/**
 * Extract a human-readable error message from an Axios error or generic Error.
 * Falls back to the provided default message.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object') {
    const axiosData = (err as any).response?.data;
    if (axiosData?.message && typeof axiosData.message === 'string') return axiosData.message;
    if ((err as any).message && typeof (err as any).message === 'string') return (err as any).message;
  }
  return fallback;
}
