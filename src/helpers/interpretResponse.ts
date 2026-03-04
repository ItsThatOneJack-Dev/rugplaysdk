import { results } from "../classes/results";

export function interpretResponse(res: Response): unknown | null {
    if (res.status === 429) return results.RATE_LIMITED;
    if (res.status === 401) return results.UNAUTHORIZED;
    if (res.status === 403) return results.FORBIDDEN;
    if (res.status === 404) return results.NOT_FOUND;
    if (res.status === 400) return results.BAD_REQUEST;
    if (!res.ok) return results.FAILURE;
    return null;
}
