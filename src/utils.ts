export function wait(timeInMs: number) {
    return new Promise<void>((resolve) =>
        setTimeout(() => resolve(), timeInMs)
    );
}
