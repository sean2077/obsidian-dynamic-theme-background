import { requireApiVersion } from "obsidian";
import type { SliderComponent } from "obsidian";

type LegacySliderTooltip = {
    setDynamicTooltip(): unknown;
};

type ImperativeSettingSurface = {
    display(): void;
};

type DualSettingSurface = ImperativeSettingSurface & {
    update(): void;
};

/** Preserve visible slider values on supported Obsidian versions before 1.13. */
export function preserveSliderValueVisibility(slider: SliderComponent): SliderComponent {
    if (!requireApiVersion("1.13.0")) {
        (slider as unknown as LegacySliderTooltip).setDynamicTooltip();
    }
    return slider;
}

/** Keep the imperative settings renderer used by the plugin's older-version compatibility path. */
export function displayImperativeSettings(surface: ImperativeSettingSurface): void {
    surface.display();
}

/** Refresh declarative definitions on 1.13+, while preserving the older imperative path. */
export function refreshDualSettings(surface: DualSettingSurface): void {
    if (requireApiVersion("1.13.0")) {
        surface.update();
    } else {
        surface.display();
    }
}
