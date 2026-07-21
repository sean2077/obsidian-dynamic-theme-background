import type { BackgroundItem, DTBSettings } from "../types";

export interface BackgroundSelectionPlan {
    background: BackgroundItem | null;
    needsUpdate: boolean;
    nextIndex?: number;
}

interface BackgroundSelectionInput {
    backgrounds: readonly BackgroundItem[];
    currentBackground: BackgroundItem | null;
    currentIndex: number;
    intervalBackground?: BackgroundItem | null;
    mode: DTBSettings["mode"];
    ruleBackgroundId?: string | null;
}

/** Resolve mode-specific selection without scheduling, network, or rendering side effects. */
export function selectBackgroundPlan(input: BackgroundSelectionInput): BackgroundSelectionPlan {
    if (input.mode === "interval") {
        if (input.intervalBackground) {
            return { background: input.intervalBackground, needsUpdate: true };
        }
        if (input.backgrounds.length === 0) {
            return { background: input.currentBackground, needsUpdate: false };
        }
        const nextIndex = (input.currentIndex + 1) % input.backgrounds.length;
        return {
            background: input.backgrounds[nextIndex] ?? null,
            needsUpdate: true,
            nextIndex,
        };
    }

    if (input.mode === "time-based") {
        const background = input.ruleBackgroundId
            ? (input.backgrounds.find((item) => item.id === input.ruleBackgroundId) ?? null)
            : null;
        return {
            background,
            needsUpdate: input.currentBackground?.id !== background?.id,
        };
    }

    return {
        background: input.backgrounds[input.currentIndex] ?? null,
        needsUpdate: false,
    };
}
