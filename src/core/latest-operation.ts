export type OperationResult = "applied" | "superseded";

/**
 * Runs work concurrently while allowing only the newest result to commit.
 */
export class LatestOperation {
    private generation = 0;
    private pending = 0;

    get isRunning(): boolean {
        return this.pending > 0;
    }

    invalidate(): void {
        this.generation += 1;
    }

    async run<T>(work: () => Promise<T>, commit: (value: T) => void | Promise<void>): Promise<OperationResult> {
        const generation = ++this.generation;
        this.pending += 1;
        try {
            const value = await work();
            if (generation !== this.generation) return "superseded";
            await commit(value);
            return "applied";
        } finally {
            this.pending -= 1;
        }
    }
}
