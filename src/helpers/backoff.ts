// -------------------------
// Config types
// -------------------------

export interface BackoffConfig {
    initialDelay: number;
    maxDelay?: number;
    maxRetries?: number;
    shouldRetry?: (result: unknown, step: number) => boolean;
    onRetry?: (step: number, lastBackoff: number, nextBackoff: number) => void;
    onAbort?: () => unknown;
}

export interface LinearBackoffConfig extends BackoffConfig {
    increment: number;
}

export interface ExponentialBackoffConfig extends BackoffConfig {
    base?: number;
    multiplier?: number;
}

export interface LogarithmicBackoffConfig extends BackoffConfig {
    base?: number;
    multiplier?: number;
}

export interface SteppedBackoffConfig extends BackoffConfig {
    steps: number[];
}

// -------------------------
// Callback type
// -------------------------

export type BackoffCallback<T> = (
    step: number,
    lastBackoff: number,
    config: Required<BackoffConfig>,
    peek: () => number,
    accept: (value: T) => void,
) => Promise<T> | T;

// -------------------------
// Internal runner
// -------------------------

async function runBackoff<T>(
    callback: BackoffCallback<T>,
    calcNextDelay: (step: number, lastDelay: number) => number,
    config: BackoffConfig,
): Promise<T> {
    const maxDelay = config.maxDelay ?? Infinity;
    const maxRetries = config.maxRetries ?? Infinity;
    const shouldRetry =
        config.shouldRetry ??
        ((result: unknown) => {
            return (
                typeof result === "object" &&
                result !== null &&
                "__result" in result &&
                (result as any).__result === "RATE_LIMITED"
            );
        });

    const resolved = {
        initialDelay: config.initialDelay,
        maxDelay,
        maxRetries,
        shouldRetry,
        onRetry: config.onRetry ?? (() => {}),
        onAbort: config.onAbort ?? (() => lastResult),
    } as Required<BackoffConfig>;

    let step = 0;
    let lastBackoff = 0;
    let lastResult: T;
    let accepted = false;
    let acceptedValue: T;

    while (true) {
        accepted = false;

        const peek = () => {
            const next = calcNextDelay(step + 1, lastBackoff);
            return Math.min(next, maxDelay);
        };

        const accept = (value: T) => {
            accepted = true;
            acceptedValue = value;
        };

        lastResult = await callback(step, lastBackoff, resolved, peek, accept);

        if (accepted) return acceptedValue!;
        if (!shouldRetry(lastResult, step)) return lastResult;
        if (step >= maxRetries) return (resolved.onAbort() as T) ?? lastResult;

        const nextDelay = Math.min(
            calcNextDelay(step + 1, lastBackoff),
            maxDelay,
        );
        resolved.onRetry(step, lastBackoff, nextDelay);

        await new Promise((r) => setTimeout(r, nextDelay));
        lastBackoff = nextDelay;
        step++;
    }
}

// -------------------------
// Linear backoff
// -------------------------

export async function linearBackoff<T>(
    callback: BackoffCallback<T>,
    config: LinearBackoffConfig,
): Promise<T> {
    return runBackoff(
        callback,
        (step) => config.initialDelay + config.increment * step,
        config,
    );
}

// -------------------------
// Exponential backoff
// -------------------------

export async function exponentialBackoff<T>(
    callback: BackoffCallback<T>,
    config: ExponentialBackoffConfig,
): Promise<T> {
    const base = config.base ?? 2;
    const multiplier = config.multiplier ?? 1;
    return runBackoff(
        callback,
        (step) => multiplier * config.initialDelay * Math.pow(base, step),
        config,
    );
}

// -------------------------
// Logarithmic backoff
// -------------------------

export async function logarithmicBackoff<T>(
    callback: BackoffCallback<T>,
    config: LogarithmicBackoffConfig,
): Promise<T> {
    const base = config.base ?? Math.E;
    const multiplier = config.multiplier ?? 1;
    return runBackoff(
        callback,
        (step) =>
            (multiplier * config.initialDelay * Math.log(step + Math.E)) /
            Math.log(base),
        config,
    );
}

// -------------------------
// Stepped backoff
// -------------------------

export async function steppedBackoff<T>(
    callback: BackoffCallback<T>,
    config: SteppedBackoffConfig,
): Promise<T> {
    const steps = config.steps;
    return runBackoff(
        callback,
        (step) => steps[Math.min(step, steps.length - 1)],
        {
            ...config,
            maxRetries: config.maxRetries ?? steps.length - 1,
        },
    );
}

// -------------------------
// Custom backoff
// -------------------------

export async function customBackoff<T>(
    callback: BackoffCallback<T>,
    delayCalculator: (step: number, lastBackoff: number) => number,
    config: BackoffConfig,
): Promise<T> {
    return runBackoff(callback, delayCalculator, config);
}
