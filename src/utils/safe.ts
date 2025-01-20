export type Safe<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export function safe<T>(promise: Promise<T>, err?: string): Promise<Safe<T>>;
export function safe<T>(func: () => T, err?: string): Safe<T>;
export function safe<T>(
  promiseOrFunc: Promise<T> | (() => T),
  err?: string
): Promise<Safe<T>> | Safe<T> {
  return isPromise(promiseOrFunc) ? safeAsync(promiseOrFunc, err) : safeSync(promiseOrFunc, err);
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as Promise<T>).then === "function"
  );
}

async function safeAsync<T>(promise: Promise<T>, err?: string): Promise<Safe<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, err) };
  }
}

function safeSync<T>(func: () => T, err?: string): Safe<T> {
  try {
    return { ok: true, data: func() };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, err) };
  }
}

function getErrorMessage(error: unknown, customError?: string): string {
  if (customError !== undefined) return customError;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong";
}
